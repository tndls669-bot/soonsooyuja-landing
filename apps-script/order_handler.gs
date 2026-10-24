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

    var smsResult = sendSms_(order.phone,
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
      '입금 확인 · 고객에게 문자 보내기</a>');
  }

  var smsResult = sendSms_(o.phone, paidMessage_(o));
  var paidAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  setCell_(found.row, COL.STATUS, STATUS_PAID);
  setCell_(found.row, COL.PAID_AT, paidAt);
  setCell_(found.row, COL.SMS_PAID, smsResult);

  return page_('입금 확인 완료', summary + '<br><br>고객 문자: ' + esc_(smsResult));
}

function paidMessage_(o) {
  var shipping = String(o.product).indexOf('예약') !== -1
    ? '예약 상품은 11월 중순부터 순차 배송됩니다.'
    : '상품은 순차적으로 발송되며, 발송되면 다시 안내드리겠습니다.';
  return '[순수유자] ' + o.name + '님 ' + formatWon_(o.total) + ' 입금 확인되었습니다. 감사합니다.\n' + shipping;
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
