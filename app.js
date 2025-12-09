// ============================================
// 설정 - 여기에 본인 정보 입력
// ============================================
const CONFIG = {
    // Google Cloud Console에서 발급받은 OAuth Client ID
    GOOGLE_CLIENT_ID: '7111310844-0ki2k927cfq13p40ftugrpf2fev8616j.apps.googleusercontent.com',

    // 접근 허용할 이메일 주소 (본인 이메일)
    ALLOWED_EMAILS: [
        'hello.jguru@gmail.com'
    ]
};

// 앱 상태
const state = {
    user: null, // 로그인한 사용자 정보
    sheetId: '',
    sheetName: 'Sheet1',
    apiKey: '',
    webAppUrl: '', // Google Apps Script 웹앱 URL
    questions: [],
    currentIndex: 0,
    showKorean: true, // true: D열(한글), false: C열(영어)
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
    apiKeyInput: document.getElementById('api-key'),
    webAppUrlInput: document.getElementById('webapp-url'),
    startBtn: document.getElementById('start-btn'),
    progress: document.getElementById('progress'),
    langToggle: document.getElementById('lang-toggle'),
    questionIndex: document.getElementById('question-index'),
    questionText: document.getElementById('question-text'),
    answerBtns: document.querySelectorAll('.answer-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
};

// 초기화
function init() {
    // Google Sign-In 초기화
    initGoogleSignIn();

    // 이벤트 리스너
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.startBtn.addEventListener('click', startQuiz);
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
}

// Google Sign-In 초기화
function initGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true, // 자동 로그인 시도
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

    // 이미 로그인된 세션 확인
    const savedUser = localStorage.getItem('quizUser');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        if (isEmailAllowed(user.email)) {
            state.user = user;
            showSetupScreen();
        }
    }
}

// Google 로그인 응답 처리
function handleCredentialResponse(response) {
    // JWT 토큰 디코딩
    const payload = decodeJwtPayload(response.credential);

    if (!payload) {
        showLoginError('로그인 처리 중 오류가 발생했습니다.');
        return;
    }

    const email = payload.email;
    const name = payload.name;

    // 이메일 허용 여부 확인
    if (!isEmailAllowed(email)) {
        showLoginError(`접근이 거부되었습니다.\n(${email})`);
        return;
    }

    // 로그인 성공
    state.user = { email, name };
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
    const savedApiKey = localStorage.getItem('quizApiKey');
    const savedWebAppUrl = localStorage.getItem('quizWebAppUrl');

    if (savedSheetId) elements.sheetIdInput.value = savedSheetId;
    if (savedSheetName) elements.sheetNameInput.value = savedSheetName;
    if (savedApiKey) elements.apiKeyInput.value = savedApiKey;
    if (savedWebAppUrl) elements.webAppUrlInput.value = savedWebAppUrl;
}

// 로그아웃 처리
function handleLogout() {
    state.user = null;
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
    state.apiKey = elements.apiKeyInput.value.trim();
    state.webAppUrl = elements.webAppUrlInput.value.trim();

    if (!state.sheetId || !state.apiKey) {
        alert('Sheet ID와 API Key를 입력해주세요.');
        return;
    }

    // 설정 저장
    localStorage.setItem('quizSheetId', state.sheetId);
    localStorage.setItem('quizSheetName', state.sheetName);
    localStorage.setItem('quizApiKey', state.apiKey);
    localStorage.setItem('quizWebAppUrl', state.webAppUrl);

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

// Google Sheets에서 문제 로드
async function loadQuestions() {
    // A열(문제번호), B열(인덱스), C열(영문), D열(한글), F열(응답) 로드
    // 3행부터 시작
    const range = `${state.sheetName}!A3:F`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${state.sheetId}/values/${range}?key=${state.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API 요청 실패');
    }

    const data = await response.json();
    const rows = data.values || [];

    state.questions = rows.map((row, i) => ({
        rowNumber: i + 3, // 실제 스프레드시트 행 번호
        number: row[0] || '',      // A열: 문제 번호
        index: row[1] || '',       // B열: 인덱스 (1.1 등)
        questionEng: row[2] || '', // C열: 영문 문제
        questionKor: row[3] || '', // D열: 한글 문제
        response: row[5] || '',    // F열: 사용자 응답 (E열 건너뜀)
    }));

    console.log(`${state.questions.length}개 문제 로드됨`);
}

// 문제 렌더링
function renderQuestion() {
    const q = state.questions[state.currentIndex];
    if (!q) return;

    // 진행률
    elements.progress.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;

    // 문제 번호
    elements.questionIndex.textContent = `Q${q.number} (${q.index})`;

    // 문제 텍스트
    const text = state.showKorean ? q.questionKor : q.questionEng;
    elements.questionText.textContent = text || '(문제 없음)';

    // 언어 토글 버튼
    elements.langToggle.textContent = state.showKorean ? 'EN' : 'KR';

    // 답안 버튼 초기화
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

    // 상태 업데이트
    q.response = answer;

    // Google Sheets에 저장
    await saveResponse(q.rowNumber, answer);
}

// 응답 저장
async function saveResponse(rowNumber, answer) {
    // 웹앱 URL이 없으면 로컬에만 저장
    if (!state.webAppUrl) {
        localStorage.setItem(`quiz_response_${state.sheetId}_${rowNumber}`, answer);
        console.log(`로컬 저장: 행 ${rowNumber}, 답: ${answer}`);
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(state.webAppUrl, {
            method: 'POST',
            mode: 'no-cors', // CORS 우회
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rowNumber: rowNumber,
                answer: answer
            })
        });

        // no-cors 모드에서는 응답을 읽을 수 없지만 저장은 됨
        console.log(`시트 저장 요청: 행 ${rowNumber}, 답: ${answer}`);

        // 로컬에도 백업 저장
        localStorage.setItem(`quiz_response_${state.sheetId}_${rowNumber}`, answer);

    } catch (error) {
        console.error('저장 실패:', error);
        // 실패 시 로컬에만 저장
        localStorage.setItem(`quiz_response_${state.sheetId}_${rowNumber}`, answer);
    } finally {
        showLoading(false);
    }
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

    quizContent.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    quizContent.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;

        // 수평 스와이프가 수직보다 클 때만
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                prevQuestion(); // 오른쪽 스와이프 = 이전
            } else {
                nextQuestion(); // 왼쪽 스와이프 = 다음
            }
        }
    }, { passive: true });
}

// 키보드 단축키
function handleKeyboard(e) {
    if (elements.setupScreen.classList.contains('active')) return;

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
