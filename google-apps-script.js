/**
 * Google Apps Script - 스프레드시트에 응답 저장용 웹앱
 *
 * 사용법:
 * 1. Google Sheets에서 확장 프로그램 > Apps Script 열기
 * 2. 아래 코드를 복사하여 붙여넣기
 * 3. SPREADSHEET_ID를 실제 시트 ID로 변경
 * 4. 배포 > 새 배포 > 웹앱 선택
 * 5. 실행 주체: 본인, 액세스: 모든 사용자
 * 6. 배포 후 웹앱 URL 복사하여 quiz 앱에서 사용
 */

// 스프레드시트 ID (여기에 실제 ID 입력)
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Sheet1';

// GET 요청 처리 (문제 데이터 조회)
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();

    // A3:F 범위의 데이터 가져오기
    const range = sheet.getRange(3, 1, lastRow - 2, 6); // 3행부터, A~F열
    const values = range.getValues();

    const questions = values.map((row, i) => ({
      rowNumber: i + 3,
      number: row[0],      // A열
      index: row[1],       // B열
      questionEng: row[2], // C열
      questionKor: row[3], // D열
      // E열 건너뜀
      response: row[5],    // F열
    }));

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: questions }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// POST 요청 처리 (응답 저장)
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const rowNumber = params.rowNumber;
    const answer = params.answer;

    if (!rowNumber || !answer) {
      throw new Error('rowNumber와 answer가 필요합니다.');
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

    // F열(6번째 열)에 응답 저장
    sheet.getRange(rowNumber, 6).setValue(answer);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, saved: { rowNumber, answer } }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 테스트용 함수
function testDoGet() {
  const result = doGet({});
  Logger.log(result.getContent());
}

function testDoPost() {
  const result = doPost({
    postData: {
      contents: JSON.stringify({ rowNumber: 3, answer: 'B' })
    }
  });
  Logger.log(result.getContent());
}
