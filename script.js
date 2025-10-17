import {
    CONSONANT_SCORES,
    VOWEL_SCORES,
    sortWordsByUniqueVowelCount,
    sortWordsByVowelScore,
    sortWordsByConsonantScore,
    sortWordsByUniqueConsonantCount
} from './letterRanking.js';

const showAdsButton = document.getElementById('play-ads-btn');
const wordCountSpan = document.getElementById('word-count');
const wordListContainer = document.getElementById('word-list-container');
const possibleWordsCountButton = document.getElementById('possible-words-count-btn');
const answerSection = document.getElementById('answer-section');
const hiddenInput = document.getElementById('hidden-input');


let activeInputRow = null;
let currentInputPosition = 0;
let originalWordBeforeEdit = ''; // 再編集前の単語を保存する変数

let possibleWords = [];

// 単語リストを取得する関数
async function fetchWordList() {
    try {
        const url = 'https://gist.githubusercontent.com/dracos/dd0668f281e685bad51479e5acaadb93/raw/6bfa15d263d6d5b63840a8e5b64e04b382fdb079/valid-wordle-words.txt'
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const text = await response.text();
        possibleWords = text.split('\n').map(word => word.trim());
        console.log('単語リストの取得が完了しました。');
        console.log(`候補単語数: ${possibleWords.length}`);
    } catch (error) {
        console.error('単語リストの取得に失敗しました:', error);
    }
}

// マスの色を変更する関数
function changeCellColor(cell) {
    // 編集中の行の色は変更しない
    if (cell.parentElement.classList.contains('editing')) {
        return;
    }

    // セルに文字がなければ何もしない
    if (cell.textContent.trim() === '') {
        return;
    }

    const colors = ['gray', 'yellow', 'green'];
    let currentColor = null;

    // 現在の色を取得
    for (const color of colors) {
        if (cell.classList.contains(color)) {
            currentColor = color;
            break;
        }
    }

    // 次の色に切り替える
    let nextColorIndex = (colors.indexOf(currentColor) + 1) % colors.length;
    let nextColor = colors[nextColorIndex];

    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    const allRows = document.querySelectorAll('#input-section .row');

    // もし次の色が緑なら、同じ列に異なる文字の緑セルがあればリセット
    if (nextColor === 'green') {
        const newLetter = cell.textContent.trim().toLowerCase();
        allRows.forEach(row => {
            const cellInSameColumn = row.children[cellIndex];
            const existingLetter = cellInSameColumn.textContent.trim().toLowerCase();
            if (cellInSameColumn.classList.contains('green') && existingLetter !== newLetter) {
                cellInSameColumn.classList.remove('green');
            }
        });
    }

    // もし次の色が黄色なら、ユニークな黄色文字が5つを超えないかチェック
    if (nextColor === 'yellow') {
        const newLetter = cell.textContent.trim().toLowerCase();
        if (newLetter) {
            const uniqueYellowLetters = new Set();
            document.querySelectorAll('#input-section .cell.yellow').forEach(yellowCell => {
                uniqueYellowLetters.add(yellowCell.textContent.trim().toLowerCase());
            });
            // 新しい文字が既存の黄色文字セットになく、かつセットのサイズが既に5以上の場合
            if (!uniqueYellowLetters.has(newLetter) && uniqueYellowLetters.size >= 5) {
                return; // 6種類目の黄色は許可しない
            }
        }
    }

    // クラスを付け替える
    if (currentColor) {
        cell.classList.remove(currentColor);
    }
    cell.classList.add(nextColor);
    displayPossibleWords();
    updateSolutionSection();
}


// 各マスにクリックイベントを追加
document.querySelectorAll('#input-section .cell').forEach(cell => {
    cell.addEventListener('click', (event) => {
        const row = cell.parentElement;
        // 既に文字が入っているセルをクリックした場合
        if (cell.textContent.trim().length > 0 && !row.classList.contains('editing')) {
            changeCellColor(cell);
        // 編集中の行のセルをクリックした場合
        } else if (row.classList.contains('editing')) {
            // 編集中の操作はキーボード入力に任せるため、何もしない
        // 空のセルをクリックした場合
        } else {
            startEditing(row);
        }
    });
});

// 行の編集を開始する関数
function startEditing(row) {
    // 他の行が編集中ならキャンセル
    if (activeInputRow && activeInputRow !== row) {
        cancelEditing();
    }
    // 再編集の場合、元の単語を保存し、fixedクラスを削除
    if (originalWordBeforeEdit.length === 0) {
        originalWordBeforeEdit = Array.from(row.children).map(cell => cell.textContent).join('');
    };

    
    // 行の文字をクリアして、先頭から入力できるようにする
    row.querySelectorAll('.cell').forEach(cell => {
        cell.textContent = null;
        // 背景色をリセットするために、色クラスを削除
        cell.classList.remove('gray', 'yellow', 'green');
    });

    activeInputRow = row;
    currentInputPosition = 0; // 常に先頭から入力開始

    row.classList.remove('fixed');
    row.classList.add('editing');
    // スマホのキーボードをアクティベートするために非表示inputにフォーカス
    hiddenInput.focus();
}

// 行の編集をキャンセルする関数
function cancelEditing() {
    hiddenInput.blur(); // フォーカスを外してキーボードを閉じる
    if (!activeInputRow) return;

    if (originalWordBeforeEdit) {
        // 再編集をキャンセルした場合は元の単語に戻す
        activeInputRow.querySelectorAll('.cell').forEach((cell, index) => {
            cell.textContent = originalWordBeforeEdit[index] || '';
        });
        activeInputRow.classList.add('fixed'); // 再び固定する
    } else {
        // 新規入力をキャンセルした場合は文字をクリア
        activeInputRow.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
        });
    }
    activeInputRow.classList.remove('editing');
    activeInputRow = null;
    currentInputPosition = 0;
    originalWordBeforeEdit = '';
}

// 入力された単語を検証し、行を固定する関数
function validateAndFixWord(row) {
    const cells = row.querySelectorAll('.cell');
    let word = '';
    cells.forEach(cell => {
        word += cell.textContent.trim();
    });

    if (word.length === 5) {
        if (possibleWords.includes(word.toLowerCase())) {
            // 有効な単語の場合
            row.classList.add('fixed'); // 行を固定
            row.classList.remove('editing');
            cells.forEach(cell => cell.classList.add('gray')); // 文字をグレーに
            activeInputRow = null;
            currentInputPosition = 0;
            displayPossibleWords();
            updateSolutionSection();
        } else {
            // 無効な単語の場合
            const container = document.querySelector('.container');
            container.classList.add('shake');
            setTimeout(() => container.classList.remove('shake'), 500);
        }
    }
}

// キー入力を処理する関数
function handleKeyInput(event) {
    // 物理キーボード用の処理
    if (!activeInputRow) return;

    const { key } = event;
    const cells = activeInputRow.querySelectorAll('.cell');

    if (key === 'Backspace' && currentInputPosition > 0) {
        currentInputPosition--;
        cells[currentInputPosition].textContent = '';
    } else if (key === 'Enter' && currentInputPosition === 5) {
        validateAndFixWord(activeInputRow);
    } else if (key === 'Escape') {
        cancelEditing();
    }
}

// スマホのソフトウェアキーボードからの入力を処理する関数
function handleSoftwareKeyInput(event) {
    if (!activeInputRow) return;

    const cells = activeInputRow.querySelectorAll('.cell');
    const inputType = event.inputType;
    const data = event.data;

    // 物理キーボードとソフトウェアキーボード両方の文字入力を処理
    if (inputType === 'insertText' && data) {
        // 1文字ずつ処理
        for (const char of data.toLowerCase()) {
            if (char.match(/^[a-z]$/) && currentInputPosition < 5) {
                cells[currentInputPosition].textContent = char;
                currentInputPosition++;
                if (currentInputPosition === 5) {
                    validateAndFixWord(activeInputRow);
                }
            }
        }
    }

    hiddenInput.value = ''; // inputを常に空にしておく
}

// 候補単語を絞り込む関数
function filterPossibleWords() {
    const inputRows = document.querySelectorAll('#input-section .row');
    const greenLetters = [];
    const grayLetters = [];
    let greenLettersInPosition = Array(5).fill(null);
    // 黄色文字とその位置を格納するオブジェクト (例: { e: [1, 4], s: [0] })
    let yellowLettersInPosition = {};

    inputRows.forEach(row => {
        const cells = row.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            const letter = cell.textContent.trim().toLowerCase();
            if (!letter) return;
            if (cell.classList.contains('green')) {
                greenLettersInPosition[index] = letter;
                greenLetters.push(letter);
            } else if (cell.classList.contains('yellow')) {
                // 文字をキーとして、その文字が黄色だった位置(index)を配列に格納
                if (!yellowLettersInPosition[letter]) {
                    yellowLettersInPosition[letter] = [];
                }
                yellowLettersInPosition[letter].push(index);
            } else if (cell.classList.contains('gray')) {
                grayLetters.push(letter);
            }
        });
    });

    // filterを連結して、段階的に単語を絞り込む
    let filteredWords = possibleWords.filter(word => filterByGreenLetters(word, greenLettersInPosition));
    filteredWords = filteredWords.filter(word => filterByYellowLetters(word, yellowLettersInPosition));
    filteredWords = filteredWords.filter(word => filterByGrayLetters(word, grayLetters, greenLetters, Object.keys(yellowLettersInPosition)));

    // 空文字列を取り除く
    filteredWords = filteredWords.filter(word => word.trim() !== '');

    // 絞り込んだ単語を使いやすい単語順にソートして返す
    filteredWords = sortWordsByVowelScore(filteredWords, false);
    filteredWords = sortWordsByUniqueVowelCount(filteredWords, false);
    filteredWords = sortWordsByConsonantScore(filteredWords, false);
    filteredWords = sortWordsByUniqueConsonantCount(filteredWords, false);

    return filteredWords;
}

// 緑色の文字（位置も正しい）に基づいて単語をフィルタリング
function filterByGreenLetters(word, greenLettersInPosition) {
    for (let i = 0; i < 5; i++) {
        if (greenLettersInPosition[i] && word[i] !== greenLettersInPosition[i]) {
            return false;
        }
    }
    return true;
}

// 黄色の文字（文字は含まれるが、位置が正しくない）に基づいて単語をフィルタリング
// word: 候補の単語 (例: "apple")
// yellowLettersInPosition: 黄色とマークされた文字がどの位置にあったかの情報 (例: { p: [0, 4], l: [2] })
function filterByYellowLetters(word, yellowLettersInPosition) {
    for (const letter in yellowLettersInPosition) {
        // １．yellowLettersInPositionのキーがwordに含まれていなければfalseを返す
        if (!word.includes(letter)) {
            return false;
        }
        // ２．yellowLettersInPositionを利用して、該当のアルファベットがその位置に含まれていたらfalseを返す
        for (const index of yellowLettersInPosition[letter]) {
            if (word[index] === letter) {
                return false;
            }
        }
    }
    return true;
}
// 灰色の文字（単語に含まれない）に基づいて単語をフィルタリング
function filterByGrayLetters(word, grayLetters, greenLetters, yellowLetters) {
    const yellowLetterSet = new Set(yellowLetters);
    const greenLetterSet = new Set(greenLetters);

    for (const letter of grayLetters) {
        // 灰色としてマークされた文字が、緑色や黄色としても存在する場合はスキップ
        if (greenLetterSet.has(letter) || yellowLetterSet.has(letter)) {
            continue;
        }
        if (word.includes(letter)) {
            return false;
        }
    }
    return true;
}

// 候補単語を画面に表示する関数
function displayPossibleWords() {
    const filteredWords = filterPossibleWords();
    wordCountSpan.textContent = `see ${filteredWords.length} possible words`;

    wordListContainer.innerHTML = '';
    filteredWords.forEach(word => {
        const wordItem = document.createElement('div');
        wordItem.textContent = word;
        wordItem.classList.add('word-item');
        wordListContainer.appendChild(wordItem);
    });

    // 候補の数に応じて高さを調整し、広告ボタンの表示を切り替える
    // if (0 < filteredWords.length && filteredWords.length < 3) {
    //     console.log('single-word');
    //     showAdsButton.classList.remove('hidden');
    //     answerSection.style.setProperty('--answer-height', '18%');
    // } else if (0 < filteredWords.length && filteredWords.length < 5) {
    //     console.log('single-word');
    //     showAdsButton.classList.remove('hidden');
    //     answerSection.style.setProperty('--answer-height', '38%');

    // } else {
    //     console.log('multi-word');
    //     showAdsButton.classList.add('hidden');
    //     answerSection.style.setProperty('--answer-height', '59%');
    // }
}
function setAnswerSectionHeight() {
    const height = '--height'
    const actualHeight = wordListContainer.offsetHeight;
    // possibleWordsCountButton.style.setProperty(height, `${actualHeight}px`);
    answerSection.style.setProperty('--answer-height', `${actualHeight}px`);
}
// 候補リストの表示/非表示を切り替える
possibleWordsCountButton.addEventListener('click', (event) => {
    possibleWordsCountButton.classList.add('hidden');
    wordListContainer.classList.remove('hidden');
});
// 候補リストの表示/非表示を切り替える
wordListContainer.addEventListener('click', (event) => {
    wordListContainer.classList.add('hidden');
    possibleWordsCountButton.classList.remove('hidden');
});

// 広告を表示する関数
function showFullScreenAd() {
    alert('全画面広告が表示されます！'); // 実際の広告SDKのコードに置き換えます
    
    // 広告の後の画面に切り替える
    showThanksScreen();
}

// 広告後の画面を表示する関数
function showThanksScreen() {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="end-screen">
            <img src="https://i.ibb.co/L5hYwK6/thanks-for-playing.png" alt="Thanks for playing" style="width: 250px; margin-bottom: 20px;">
            <button id="solve-again-btn">solve wordle again</button>
        </div>
    `;

    // 「solve wordle again」ボタンのイベントリスナー
    document.getElementById('solve-again-btn').addEventListener('click', () => {
        window.location.reload();
    });
}

// 解答セクションを更新する関数
function updateSolutionSection() {
    const inputRows = document.querySelectorAll('#input-section .row');
    const greenLettersInPosition = Array(5).fill('');
    const yellowLetterSet = new Set();

    // 入力セクションから緑色と黄色の文字情報を収集
    inputRows.forEach(row => {
        const cells = row.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            const letter = cell.textContent.trim().toLowerCase();
            if (!letter) return;

            if (cell.classList.contains('green')) {
                greenLettersInPosition[index] = letter;
            } else if (cell.classList.contains('yellow')) {
                // 黄色の文字が既に含まれていないか確認してから追加
                yellowLetterSet.add(letter);
            }
        });
    });

    // 黄色の文字リストから、緑色で確定した文字を除外する
    const greenLetters = greenLettersInPosition.filter(letter => letter !== '');
    greenLetters.forEach(letter => yellowLetterSet.delete(letter));
    const yellowLetters = Array.from(yellowLetterSet);


    // 緑色のマスを更新
    const greenCells = document.querySelectorAll('#solution-grid .green-row .cell');
    greenCells.forEach((cell, index) => {
        cell.textContent = greenLettersInPosition[index].toUpperCase() || '';
    });

    // 黄色のマスを更新
    const yellowCells = document.querySelectorAll('#solution-grid .yellow-row .cell');
    yellowCells.forEach((cell, index) => {
        cell.textContent = yellowLetters[index] ? yellowLetters[index].toUpperCase() : '';
    });
}

// グリッドの初期状態を設定する関数
function initializeGrid() {
    document.querySelectorAll('#input-section .row').forEach(row => {
        const hasText = Array.from(row.children).some(cell => cell.textContent.trim() !== '');
        if (hasText) {
            // 初期単語が入っている行を固定状態にする
            row.classList.add('fixed');
            row.querySelectorAll('.cell').forEach(cell => {
                // セルに文字が含まれていれば 'gray' クラスを追加
                cell.classList.add('gray');
            });
        }
    });
    // 初期状態に基づいて候補単語と解答サマリーを更新
    displayPossibleWords();
    updateSolutionSection();

    // --- letterRanking.jsの関数使用例 ---
    // 候補単語を子音スコアの高い順にソートして表示
    const sortedByConsonant = sortWordsByConsonantScore(possibleWords);
    console.log('Words sorted by consonant score (desc):', sortedByConsonant.slice(0, 10)); // 上位10件を表示
}

// アプリケーション起動時に単語リストを取得
document.addEventListener('DOMContentLoaded', async () => {
    await fetchWordList(); // 単語リストの取得を待つ
    initializeGrid();      // グリッドを初期化する

    // 物理キーボード入力イベントリスナーを追加
    document.addEventListener('keydown', handleKeyInput);
    // ソフトウェアキーボード入力イベントリスナーを追加
    hiddenInput.addEventListener('input', handleSoftwareKeyInput);

    // グリッド外クリックで編集をキャンセルするイベントリスナー
    document.addEventListener('click', (event) => {
        // クリックされた要素が入力セクションやその子孫でない場合に編集をキャンセル
        if (activeInputRow && !event.target.closest('.container')) {
            cancelEditing();
        }
    });

    // 各行に長押しイベントを追加
    document.querySelectorAll('#input-section .row').forEach(row => {
        let pressTimer;

        const startPress = (e) => {
            // 固定された行でのみ長押しを有効にする
            if (row.classList.contains('fixed')) {
                pressTimer = window.setTimeout(() => startEditing(row), 800);
            }
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        // マウスイベント
        row.addEventListener('mousedown', startPress);
        row.addEventListener('mouseup', cancelPress);
        row.addEventListener('mouseleave', cancelPress);

        // タッチイベント
        row.addEventListener('touchstart', startPress);
        row.addEventListener('touchend', cancelPress);
        row.addEventListener('touchcancel', cancelPress);
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
            console.log('Service Worker registered:', registration);
        })
        .catch(error => {
            console.error('Service Worker registration failed:', error);
        });
    });
}
