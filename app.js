// ============================================
// 설정 - 여기에 본인 정보 입력
// ============================================
const CONFIG = {
    // Google Cloud Console에서 발급받은 OAuth Client ID
    GOOGLE_CLIENT_ID: '7111310844-0ki2k927cfq13p40ftugrpf2fev8616j.apps.googleusercontent.com',

    // 접근 허용할 이메일 주소 (본인 이메일)
    ALLOWED_EMAILS: [
        'hello.jguru@gmail.com'
    ],

    // Google Sheets API 스코프
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};

// 앱 상태
const state = {
    user: null,
    accessToken: null, // OAuth 액세스 토큰
    tokenClient: null, // Google Token Client
    sheetId: '',
    sheetName: 'Sheet1',
    questions: [],
    currentIndex: 0,
    showKorean: true,
};

// DOM 요소
const elements = {
    loginScreen: document.getElementById('login-screen'),
    setupScreen: document.getElementById('setup-screen'),
    quizScreen: document.getElementById('quiz-screen'),
    loading: document.getElementById('loading'),
    googleSigninBtn: document.getElementById('google-signin-btn'),
    loginError: document.getElementById('login-error'),
    userEmail: document.getElementById('user-email'),
    logoutBtn: document.getElementById('logout-btn'),
    sheetIdInput: document.getElementById('sheet-id'),
    sheetNameInput: document.getElementById('sheet-name'),
    startBtn: document.getElementById('start-btn'),
    progress: document.getElementById('progress'),
    homeBtn: document.getElementById('home-btn'),
    langToggle: document.getElementById('lang-toggle'),
    questionIndex: document.getElementById('question-index'),
    questionText: document.getElementById('question-text'),
    answerBtns: document.querySelectorAll('.answer-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
};

// 초기화
function init() {
    // 이벤트 리스너
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.startBtn.addEventListener('click', startQuiz);
    elements.homeBtn.addEventListener('click', goHome);
    elements.langToggle.addEventListener('click', toggleLanguage);
    elements.prevBtn.addEventListener('click', prevQuestion);
    elements.nextBtn.addEventListener('click', nextQuestion);

    elements.answerBtns.forEach(btn => {
        btn.addEventListener('click', () => selectAnswer(btn.dataset.answer));
    });

    // 스와이프 제스처
    setupSwipeGestures();

    // 키보드 단축키
    document.addEventListener('keydown', handleKeyboard);

    // Google Identity Services 로드 완료 대기
    waitForGoogleLibrary();
}

// Google 라이브러리 로드 대기
function waitForGoogleLibrary() {
    if (typeof google !== 'undefined' && google.accounts) {
        initGoogleAuth();
    } else {
        setTimeout(waitForGoogleLibrary, 100);
    }
}

// Google 인증 초기화
function initGoogleAuth() {
    // 1. ID 토큰용 (로그인/사용자 정보)
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
    });

    google.accounts.id.renderButton(
        elements.googleSigninBtn,
        {
            theme: 'filled_blue',
            size: 'large',
            width: 280,
            text: 'signin_with',
            locale: 'ko'
        }
    );

    // 2. 액세스 토큰용 (API 접근)
    state.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: handleTokenResponse,
    });

    // 3. 자동 로그인 시도 (One Tap)
    google.accounts.id.prompt();
}

// Google 로그인 응답 처리 (ID 토큰)
function handleCredentialResponse(response) {
    const payload = decodeJwtPayload(response.credential);

    if (!payload) {
        showLoginError('로그인 처리 중 오류가 발생했습니다.');
        return;
    }

    const email = payload.email;
    const name = payload.name;

    if (!isEmailAllowed(email)) {
        showLoginError(`접근이 거부되었습니다.\n(${email})`);
        return;
    }

    // 로그인 성공 - 이제 액세스 토큰 요청
    state.user = { email, name };

    // 액세스 토큰 요청 (Sheets API 접근용)
    state.tokenClient.requestAccessToken({ prompt: '' });
}

// 액세스 토큰 응답 처리
function handleTokenResponse(response) {
    if (response.error) {
        showLoginError('API 접근 권한을 얻지 못했습니다.');
        console.error('Token error:', response);
        return;
    }

    state.accessToken = response.access_token;
    localStorage.setItem('quizUser', JSON.stringify(state.user));
    showSetupScreen();
}

// JWT 페이로드 디코딩
function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('JWT 디코딩 실패:', e);
        return null;
    }
}

// 이메일 허용 여부 확인
function isEmailAllowed(email) {
    return CONFIG.ALLOWED_EMAILS.some(
        allowed => allowed.toLowerCase() === email.toLowerCase()
    );
}

// 로그인 에러 표시
function showLoginError(message) {
    elements.loginError.textContent = message;
}

// 설정 화면 표시
function showSetupScreen() {
    elements.loginScreen.classList.remove('active');
    elements.setupScreen.classList.add('active');
    elements.userEmail.textContent = state.user.email;

    // 로컬 스토리지에서 설정 복원
    const savedSheetId = localStorage.getItem('quizSheetId');
    const savedSheetName = localStorage.getItem('quizSheetName');

    if (savedSheetId) elements.sheetIdInput.value = savedSheetId;
    if (savedSheetName) elements.sheetNameInput.value = savedSheetName;
}

// 로그아웃 처리
function handleLogout() {
    // 토큰 취소
    if (state.accessToken) {
        google.accounts.oauth2.revoke(state.accessToken);
    }

    state.user = null;
    state.accessToken = null;
    localStorage.removeItem('quizUser');
    google.accounts.id.disableAutoSelect();

    elements.setupScreen.classList.remove('active');
    elements.quizScreen.classList.remove('active');
    elements.loginScreen.classList.add('active');
    elements.loginError.textContent = '';
}

// 퀴즈 시작
async function startQuiz() {
    state.sheetId = elements.sheetIdInput.value.trim();
    state.sheetName = elements.sheetNameInput.value.trim() || 'Sheet1';

    if (!state.sheetId) {
        alert('Sheet ID를 입력해주세요.');
        return;
    }

    if (!state.accessToken) {
        alert('로그인이 필요합니다.');
        return;
    }

    // 설정 저장
    localStorage.setItem('quizSheetId', state.sheetId);
    localStorage.setItem('quizSheetName', state.sheetName);

    showLoading(true);

    try {
        await loadQuestions();
        elements.setupScreen.classList.remove('active');
        elements.quizScreen.classList.add('active');
        renderQuestion();
    } catch (error) {
        alert('데이터를 불러오는데 실패했습니다.\n' + error.message);
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// Google Sheets에서 문제 로드 (OAuth 토큰 사용)
async function loadQuestions() {
    const range = `${state.sheetName}!A3:G`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${state.sheetId}/values/${range}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${state.accessToken}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API 요청 실패');
    }

    const data = await response.json();
    const rows = data.values || [];

    state.questions = rows.map((row, i) => ({
        rowNumber: i + 3,
        number: row[0] || '',
        index: row[1] || '',
        questionEng: row[2] || '',
        questionKor: row[3] || '',
        response: row[6] || '',  // G열 (index 6)
    }));

    console.log(`${state.questions.length}개 문제 로드됨`);

    // 첫 번째 미응답 문제로 이동
    const firstUnanswered = state.questions.findIndex(q => !q.response);
    if (firstUnanswered !== -1) {
        state.currentIndex = firstUnanswered;
        console.log(`미응답 문제로 이동: ${firstUnanswered + 1}번`);
    } else {
        // 모든 문제에 응답한 경우 첫 문제로
        state.currentIndex = 0;
        console.log('모든 문제 응답 완료');
    }
}

// 문제 렌더링
function renderQuestion() {
    const q = state.questions[state.currentIndex];
    if (!q) return;

    elements.progress.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
    elements.questionIndex.textContent = `Q${q.number} (${q.index})`;

    const text = state.showKorean ? q.questionKor : q.questionEng;
    elements.questionText.textContent = text || '(문제 없음)';
    elements.langToggle.textContent = state.showKorean ? 'EN' : 'KR';

    elements.answerBtns.forEach(btn => {
        btn.classList.remove('selected', 'correct', 'wrong');
        if (q.response && btn.dataset.answer === q.response.toUpperCase()) {
            btn.classList.add('selected');
        }
    });
}

// 답안 선택
async function selectAnswer(answer) {
    const q = state.questions[state.currentIndex];
    if (!q) return;

    // UI 즉시 업데이트
    elements.answerBtns.forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.answer === answer) {
            btn.classList.add('selected');
        }
    });

    q.response = answer;

    // Google Sheets에 저장
    await saveResponse(q.rowNumber, answer);
}

// 응답 저장 (OAuth 토큰으로 직접 저장)
async function saveResponse(rowNumber, answer) {
    if (!state.accessToken) {
        console.log('토큰 없음 - 로컬에만 저장');
        localStorage.setItem(`quiz_response_${state.sheetId}_${rowNumber}`, answer);
        return;
    }

    try {
        const range = `${state.sheetName}!G${rowNumber}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${state.sheetId}/values/${range}?valueInputOption=RAW`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${state.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                values: [[answer]]
            })
        });

        if (!response.ok) {
            throw new Error('저장 실패');
        }

        console.log(`시트 저장 완료: 행 ${rowNumber}, 답: ${answer}`);

    } catch (error) {
        console.error('저장 실패:', error);
        localStorage.setItem(`quiz_response_${state.sheetId}_${rowNumber}`, answer);
    }
}

// 홈으로 이동
function goHome() {
    elements.quizScreen.classList.remove('active');
    elements.setupScreen.classList.add('active');
}

// 언어 토글
function toggleLanguage() {
    state.showKorean = !state.showKorean;
    renderQuestion();
}

// 이전 문제
function prevQuestion() {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        renderQuestion();
    }
}

// 다음 문제
function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        renderQuestion();
    }
}

// 스와이프 제스처
function setupSwipeGestures() {
    let startX = 0;
    let startY = 0;

    const quizContent = document.querySelector('.quiz-content');
    if (!quizContent) return;

    quizContent.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    quizContent.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                prevQuestion();
            } else {
                nextQuestion();
            }
        }
    }, { passive: true });
}

// 키보드 단축키
function handleKeyboard(e) {
    if (elements.setupScreen.classList.contains('active')) return;
    if (elements.loginScreen.classList.contains('active')) return;

    switch (e.key) {
        case 'ArrowLeft':
            prevQuestion();
            break;
        case 'ArrowRight':
            nextQuestion();
            break;
        case 'a':
        case 'A':
        case '1':
            selectAnswer('A');
            break;
        case 'b':
        case 'B':
        case '2':
            selectAnswer('B');
            break;
        case 'c':
        case 'C':
        case '3':
            selectAnswer('C');
            break;
        case 'd':
        case 'D':
        case '4':
            selectAnswer('D');
            break;
        case 'e':
        case 'E':
            toggleLanguage();
            break;
    }
}

// 로딩 표시
function showLoading(show) {
    if (show) {
        elements.loading.classList.add('active');
    } else {
        elements.loading.classList.remove('active');
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', init);
