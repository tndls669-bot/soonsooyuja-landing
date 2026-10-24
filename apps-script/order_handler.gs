/**
 * 순수유자 홈페이지 주문 처리 (Google Apps Script 웹앱)
 *
 * 흐름
 *  1) 홈페이지 "직접 주문" 제출 → doPost
 *     - 구글 시트 "순수유자 홈페이지 주문"에 입금대기로 기록
 *     - 대표님께 주문 메일 (입금 확인 버튼 링크 포함)
 *     - 고객에게 주문 접수 + 입금 안내 문자
 *  2) 카카오뱅크 입금을 보고 메일 속 링크 클릭 → doGet (확인 화면)
 *     → "입금 확인" 버튼 → 시트 입금완료 + 고객에게 입금 확인 문자
 *
 * 문자는 대표님 안드로이드 폰의 MacroDroid 웹훅으로 보낸다.
 * 스크립트 속성(프로젝트 설정 → 스크립트 속성)에 SMS_WEBHOOK_URL을 넣으면 켜지고,
 * 비어 있으면 문자만 건너뛰고 나머지는 그대로 동작한다.
 */

var OWNER_EMAIL = 'tndls669@gmail.com';
var BANK_ACCOUNT = '카카오뱅크 3333-19-3570222 채수인';
var SHEET_NAME = '순수유자 홈페이지 주문';

var COL = {
  ID: 1, CREATED: 2, NAME: 3, PHONE: 4, ADDRESS: 5, PRODUCT: 6, QTY: 7,
  TOTAL: 8, STATUS: 9, PAID_AT: 10, TOKEN: 11, SMS_ORDER: 12, SMS_PAID: 13
};
var HEADERS = ['주문번호', '접수시각', '주문자', '연락처', '주소', '상품', '수량',
  '입금액', '상태', '입금확인시각', '확인토큰', '접수문자', '입금문자'];

var STATUS_WAITING = '입금대기';
var STATUS_PAID = '입금완료';

// ---------------------------------------------------------------- 주문 접수

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var order = saveOrder_(data);

    // 주문서는 누구나 보낼 수 있어서, 장난 주문이 몰리면 대표님 폰에서 모르는 번호로 문자가
    // 대량으로 나갈 수 있다. 자동 접수 문자에만 하루 한도와 같은 번호 재발송 간격을 둔다.
    var limit = orderSmsAllowed_(order.phone);
    var smsResult = limit !== true ? limit : sendSms_(order.phone,
      '[순수유자] ' + order.name + '님 주문이 접수되었습니다.\n' +
      '입금계좌: ' + BANK_ACCOUNT + '\n' +
      '입금액: ' + formatWon_(order.total) + '\n' +
      '입금이 확인되면 다시 안내드리겠습니다.');
    setCell_(order.row, COL.SMS_ORDER, smsResult);

    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: '[순수유자] 새 주문 - ' + order.name + '님 (' + formatWon_(order.total) + ')',
      htmlBody: orderEmailHtml_(order, smsResult)
    });

    return json_({ success: true, orderId: order.id });
  } catch (err) {
    return json_({ success: false, error: err.toString() });
  }
}

function saveOrder_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var now = new Date();
    var id = Utilities.formatDate(now, 'Asia/Seoul', 'yyMMdd-HHmmss') + '-' +
      Math.floor(Math.random() * 900 + 100);
    var token = Utilities.getUuid();
    var total = Number(data.total) || 0;

    sheet.appendRow([id, now, data.name, data.phone, data.address, data.product,
      data.qty, total, STATUS_WAITING, '', token, '', '']);

    return {
      row: sheet.getLastRow(), id: id, token: token, name: data.name,
      phone: data.phone, address: data.address, product: data.product,
      qty: data.qty, total: total
    };
  } finally {
    lock.releaseLock();
  }
}

function orderEmailHtml_(order, smsResult) {
  var confirmUrl = ScriptApp.getService().getUrl() +
    '?id=' + encodeURIComponent(order.id) + '&t=' + encodeURIComponent(order.token);
  return '<p>새로운 주문이 접수되었습니다.</p>' +
    '<p>주문번호: ' + esc_(order.id) + '<br>' +
    '주문자: ' + esc_(order.name) + '<br>' +
    '연락처: ' + esc_(order.phone) + '<br>' +
    '배송주소: ' + esc_(order.address) + '<br>' +
    '상품명: ' + esc_(order.product) + '<br>' +
    '수량: ' + esc_(order.qty) + '<br>' +
    '<b>입금액: ' + formatWon_(order.total) + '</b></p>' +
    '<p>고객 접수 문자: ' + esc_(smsResult) + '</p>' +
    '<p>카카오뱅크에 <b>' + esc_(order.name) + ' ' + formatWon_(order.total) +
    '</b> 입금이 들어오면 아래 버튼을 눌러주세요.</p>' +
    '<p><a href="' + confirmUrl + '" style="display:inline-block;padding:12px 20px;' +
    'background:#2E5936;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">' +
    '입금 확인하기</a></p>';
}

// ---------------------------------------------------------------- 입금 확인

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'export') return exportPaid_(p.key);
  if (!p.id || !p.t) return page_('잘못된 링크입니다.', '');

  var found = findOrder_(p.id, p.t);
  if (!found) return page_('주문을 찾을 수 없습니다.', '링크가 맞는지 확인해주세요.');

  var o = found.order;
  var summary = esc_(o.name) + '님 · ' + formatWon_(o.total) + '<br>' + esc_(o.product);

  if (o.status === STATUS_PAID) {
    return page_('이미 입금 확인된 주문입니다.', summary + '<br><br>확인 시각: ' + esc_(o.paidAt));
  }

  // 메일 링크만 열었을 때는 확인 화면만 보여준다 (메일 보안검사 등이 링크를 열어도 처리되지 않도록)
  if (p.confirm !== 'yes') {
    var url = ScriptApp.getService().getUrl() + '?id=' + encodeURIComponent(p.id) +
      '&t=' + encodeURIComponent(p.t) + '&confirm=yes';
    return page_('입금을 확인하셨나요?', summary +
      '<br><br><a href="' + url + '" target="_top" style="display:inline-block;padding:16px 28px;' +
      'background:#2E5936;color:#fff;border-radius:10px;text-decoration:none;font-size:18px;font-weight:bold;">' +
      '금액 맞음 · 감사 문자 보내기</a>' + aiPanelHtml_(p.id, p.t, o));
  }

  var smsResult = sendSms_(o.phone, paidMessage_(o));
  var paidAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  setCell_(found.row, COL.STATUS, STATUS_PAID);
  setCell_(found.row, COL.PAID_AT, paidAt);
  setCell_(found.row, COL.SMS_PAID, smsResult);

  return page_('입금 확인 완료', summary + '<br><br>고객 문자: ' + esc_(smsResult));
}

function paidMessage_(o) {
  var isReservation = String(o.product).indexOf('예약') !== -1;
  var shipping = isReservation
    ? '예약하신 유자는 11월 중순부터 잘 익은 열매로 정성껏 골라 순서대로 보내드릴게요.'
    : '정성껏 준비해서 보내드릴게요.';
  return '[순수유자] ' + o.name + '님, ' + formatWon_(o.total) + ' 입금 잘 받았습니다.\n' +
    '고흥 유기농 유자 농장 순수유자를 믿고 주문해 주셔서 진심으로 감사드립니다.\n' +
    shipping + '\n' +
    '발송되면 다시 연락드릴게요. 따뜻한 하루 보내세요.\n' +
    '- 순수유자 채수인 드림';
}

// ---------------------------------------------------------------- 금액이 다를 때: 대표님 판단 → AI 문자
// 입금액이 많거나 적은 경우처럼 정해진 문구로 안 되는 상황은, 대표님이 판단만 적으면
// Gemini가 순수유자 말투로 문자를 쓰고, 대표님이 미리보기를 확인한 뒤 보낸다.
// AI가 쓴 문자는 대표님이 "보내기"를 누르기 전에는 절대 나가지 않는다.

var GEMINI_MODEL = 'gemini-3.8-flash';

function aiPanelHtml_(id, token, o) {
  return '<div style="margin-top:36px;padding-top:20px;border-top:1px solid #ddd;text-align:left;">' +
    '<b>금액이 다르거나 따로 안내할 게 있나요?</b><br>' +
    '<span style="font-size:13px;color:#777;">판단만 적으시면 AI가 문자를 써요. 보내기 전에 확인할 수 있어요.</span><br><br>' +
    '실제 들어온 금액 (모르면 비워두세요)<br>' +
    '<input id="amt" inputmode="numeric" placeholder="예: 83400" style="width:100%;padding:10px;font-size:16px;box-sizing:border-box;"><br><br>' +
    '대표님 판단<br>' +
    '<textarea id="memo" rows="3" placeholder="예: 3천원 덜 들어왔으니 추가 입금 부탁 / 2천원 더 들어와서 돌려드릴게, 계좌 물어봐" ' +
    'style="width:100%;padding:10px;font-size:16px;box-sizing:border-box;"></textarea><br>' +
    '<label style="font-size:14px;"><input type="checkbox" id="done"> 이 문자로 입금 확인 처리하기 (시트 입금완료)</label><br><br>' +
    '<button onclick="draft()" style="width:100%;padding:14px;font-size:16px;background:#8a6d3b;color:#fff;border:0;border-radius:10px;">AI로 문자 만들기</button>' +
    '<div id="preview" style="display:none;margin-top:20px;">미리보기 (고쳐도 돼요)<br>' +
    '<textarea id="msg" rows="8" style="width:100%;padding:10px;font-size:15px;box-sizing:border-box;"></textarea><br><br>' +
    '<button onclick="send()" style="width:100%;padding:14px;font-size:16px;background:#2E5936;color:#fff;border:0;border-radius:10px;">이 문자 보내기</button></div>' +
    '<p id="status" style="color:#2E5936;font-weight:bold;"></p></div>' +
    '<script>var ID=' + JSON.stringify(String(id)) + ',T=' + JSON.stringify(String(token)) + ';' +
    'function st(s){document.getElementById("status").textContent=s;}' +
    'function draft(){var m=document.getElementById("memo").value.trim();if(!m){st("판단을 적어주세요.");return;}st("AI가 문자를 쓰는 중...");' +
    'google.script.run.withSuccessHandler(function(t){document.getElementById("msg").value=t;document.getElementById("preview").style.display="block";st("");})' +
    '.withFailureHandler(function(e){st("실패: "+e.message);}).aiDraft(ID,T,document.getElementById("amt").value,m);}' +
    'function send(){var t=document.getElementById("msg").value.trim();if(!t)return;st("보내는 중...");' +
    'google.script.run.withSuccessHandler(function(r){st(r);document.getElementById("preview").style.display="none";})' +
    '.withFailureHandler(function(e){st("실패: "+e.message);}).aiSend(ID,T,t,document.getElementById("done").checked);}' +
    '</script>';
}

/** 확인 화면에서 호출: 대표님 판단 → 고객 문자 초안 */
function aiDraft(id, token, amt, memo) {
  var found = findOrder_(String(id), String(token));
  if (!found) throw new Error('주문을 찾을 수 없어요.');
  var o = found.order;
  var paid = Number(String(amt || '').replace(/[^0-9]/g, '')) || 0;
  var amountLine = '주문 금액: ' + formatWon_(o.total);
  if (paid) {
    var diff = paid - Number(o.total);
    amountLine += ' / 실제 입금: ' + formatWon_(paid) +
      (diff === 0 ? ' (금액 같음)' : diff < 0 ? ' / ' + formatWon_(-diff) + ' 부족' : ' / ' + formatWon_(diff) + ' 초과');
  }
  var prompt =
    '너는 고흥 유기농 유자 농장 "순수유자" 대표 채수인 대신 고객에게 보낼 문자를 쓴다.\n' +
    '아래 "대표님 판단"의 내용을 고객에게 전하는 따뜻하고 정중한 한국어 문자로 써라.\n' +
    '규칙:\n' +
    '- 첫 줄은 "[순수유자] ' + o.name + '님," 으로 시작한다.\n' +
    '- 마지막 줄은 "- 순수유자 채수인 드림" 으로 끝낸다.\n' +
    '- 금액·계좌·날짜는 아래에 주어진 값만 그대로 쓴다. 없는 사실을 지어내지 않는다.\n' +
    '- 추가 입금을 부탁할 때만 입금계좌를 적는다.\n' +
    '- 6줄 이내, 이모지 없이, 문자 본문만 출력한다.\n\n' +
    '고객 이름: ' + o.name + '\n상품: ' + o.product + '\n' + amountLine + '\n입금계좌: ' + BANK_ACCOUNT + '\n' +
    '대표님 판단: ' + memo;
  return callGemini_(prompt);
}

/** 확인 화면에서 호출: 대표님이 확인한 문자를 보낸다 */
function aiSend(id, token, text, done) {
  var found = findOrder_(String(id), String(token));
  if (!found) throw new Error('주문을 찾을 수 없어요.');
  var smsResult = sendSms_(found.order.phone, String(text));
  setCell_(found.row, COL.SMS_PAID, '[직접안내] ' + smsResult);
  if (done) {
    setCell_(found.row, COL.STATUS, STATUS_PAID);
    setCell_(found.row, COL.PAID_AT, Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
  }
  return '고객 문자: ' + smsResult + (done ? ' · 입금완료로 처리했어요' : '');
}

function callGemini_(prompt) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('스크립트 속성에 GEMINI_API_KEY가 없어요.');
  var res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key),
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (res.getResponseCode() !== 200) throw new Error('AI 호출 실패 (' + res.getResponseCode() + ')');
  var data = JSON.parse(res.getContentText());
  return String(data.candidates[0].content.parts[0].text).trim();
}

// ---------------------------------------------------------------- 배송 자동화 연결
// PC의 배송 자동화(1단계 주문 수집)가 입금완료 주문을 가져가 우체국 접수 목록에 넣는다.
// 고객 주소·연락처가 담겨 있으므로 스크립트 속성 PIPELINE_KEY와 같은 key를 줄 때만 답한다.

function exportPaid_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('PIPELINE_KEY');
  if (!expected || key !== expected) return json_({ success: false, error: 'unauthorized' });
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  var orders = [];
  if (last >= 2) {
    var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[COL.STATUS - 1] !== STATUS_PAID) continue;
      orders.push({
        id: String(r[COL.ID - 1]), name: String(r[COL.NAME - 1]), phone: String(r[COL.PHONE - 1]),
        address: String(r[COL.ADDRESS - 1]), product: String(r[COL.PRODUCT - 1]),
        qty: r[COL.QTY - 1], total: r[COL.TOTAL - 1], paidAt: String(r[COL.PAID_AT - 1])
      });
    }
  }
  return json_({ success: true, orders: orders });
}

function findOrder_(id, token) {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[COL.ID - 1]) === id && String(r[COL.TOKEN - 1]) === token) {
      return {
        row: i + 2,
        order: {
          name: r[COL.NAME - 1], phone: r[COL.PHONE - 1], product: r[COL.PRODUCT - 1],
          total: r[COL.TOTAL - 1], status: r[COL.STATUS - 1], paidAt: r[COL.PAID_AT - 1]
        }
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------- 문자 (MacroDroid)

/** 결과를 사람이 읽을 문장으로 돌려준다. 실패해도 예외를 던지지 않는다. */
function sendSms_(phone, text) {
  var webhook = PropertiesService.getScriptProperties().getProperty('SMS_WEBHOOK_URL');
  if (!webhook) return '미발송 (문자 설정 전)';

  var to = String(phone || '').replace(/[^0-9]/g, '');
  if (!/^01[0-9]{8,9}$/.test(to)) return '미발송 (연락처 형식 오류: ' + phone + ')';

  try {
    var url = webhook + (webhook.indexOf('?') === -1 ? '?' : '&') +
      'phone=' + encodeURIComponent(to) + '&text=' + encodeURIComponent(text);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    return code >= 200 && code < 300 ? '발송 요청 완료' : '발송 실패 (응답 ' + code + ')';
  } catch (err) {
    return '발송 실패 (' + err + ')';
  }
}

var ORDER_SMS_DAILY_LIMIT = 30;       // 하루 자동 접수 문자 최대 건수
var ORDER_SMS_SAME_PHONE_SECONDS = 600; // 같은 번호로는 10분에 한 번만

/** 자동 접수 문자를 보내도 되면 true, 아니면 시트·메일에 남길 사유 문장. */
function orderSmsAllowed_(phone) {
  var to = String(phone || '').replace(/[^0-9]/g, '');
  var cache = CacheService.getScriptCache();
  if (cache.get('sms_' + to)) return '미발송 (같은 번호 10분 내 재주문)';

  // 날짜별로 속성을 새로 만들면 스크립트 속성 목록이 매일 늘어나므로 한 칸("날짜:건수")에 덮어쓴다.
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  var saved = String(props.getProperty('SMS_DAILY_COUNT') || '').split(':');
  var count = saved[0] === today ? Number(saved[1] || 0) : 0;
  if (count >= ORDER_SMS_DAILY_LIMIT) return '미발송 (하루 자동 문자 한도 ' + ORDER_SMS_DAILY_LIMIT + '건 초과)';

  props.setProperty('SMS_DAILY_COUNT', today + ':' + (count + 1));
  cache.put('sms_' + to, '1', ORDER_SMS_SAME_PHONE_SECONDS);
  return true;
}

/** 편집기에서 한 번 실행: 권한 승인 + 주문 시트 생성 */
function setup() {
  var sheet = getSheet_();
  Logger.log('주문 시트: ' + sheet.getParent().getUrl());
}

/** 편집기에서 실행: 대표님 번호로 테스트 문자 */
function testSms() {
  Logger.log(sendSms_('01088429670', '[순수유자] 문자 연동 테스트입니다.'));
}

// ---------------------------------------------------------------- 공용

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ORDER_SHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty('ORDER_SHEET_ID', ss.getId());
  }
  var sheet = ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setCell_(row, col, value) {
  getSheet_().getRange(row, col).setValue(value);
}

function formatWon_(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function page_(title, body) {
  var html = '<div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 20px;' +
    'text-align:center;color:#3E3A36;"><h2>' + esc_(title) + '</h2><p style="line-height:1.7;">' +
    body + '</p></div>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('순수유자 입금 확인')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
