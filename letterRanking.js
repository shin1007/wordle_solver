// 'https://gist.githubusercontent.com/dracos/dd0668f281e685bad51479e5acaadb93/raw/6bfa15d263d6d5b63840a8e5b64e04b382fdb079/valid-wordle-words.txt'

export const CONSONANT_SCORES = {
    's': 21, 'r': 20, 'l': 19, 't': 18, 'n': 17, 'd': 16, 'y': 15, 'm': 14, 'p': 13, 'c': 12,
    'h': 11, 'g': 10, 'b': 9, 'k': 8, 'w': 7, 'f': 6, 'v': 5, 'z': 4, 'j': 3, 'x': 2, 'q': 1
};

export const VOWEL_SCORES = {
    'e': 5, 'a': 4, 'o': 3, 'i': 2, 'u': 1
};

/**
 * 単語に含まれるユニークな母音の数で単語をソートします。
 * @param {string[]} words - ソート対象の単語リスト
 * @param {boolean} ascending - trueなら昇順、falseなら降順
 * @returns {string[]} ソートされた単語リスト
 */
export function sortWordsByUniqueVowelCount(words, ascending = false) {
    const vowels = 'aeiou';
    return words.slice().sort((a, b) => {
        const countA = new Set(a.split('').filter(char => vowels.includes(char))).size;
        const countB = new Set(b.split('').filter(char => vowels.includes(char))).size;
        const diff = countA - countB;
    if (ascending) {
            return diff;
    }
        return -diff;
    });
}

// 母音スコアの合計でソート
export function sortWordsByVowelScore(words, ascending = true) {
    return words.slice().sort((a, b) => {
        const scoreA = a.split('').reduce((sum, char) => sum + (VOWEL_SCORES[char] || 0), 0);
        const scoreB = b.split('').reduce((sum, char) => sum + (VOWEL_SCORES[char] || 0), 0);
        if (ascending) {
            return scoreA - scoreB; // 昇順
        }
        return scoreB - scoreA; // 降順
    });
}

// 子音スコアの合計でソート
export function sortWordsByConsonantScore(words, ascending = false) {
    return words.slice().sort((a, b) => {
        const scoreA = a.split('').reduce((sum, char) => sum + (CONSONANT_SCORES[char] || 0), 0);
        const scoreB = b.split('').reduce((sum, char) => sum + (CONSONANT_SCORES[char] || 0), 0);
        if (ascending) {
            return scoreA - scoreB; // 降順
        }
        return scoreB - scoreA; // 降順
    });
}

/**
 * 単語に含まれるユニークな子音の数で単語をソートします。
 * @param {string[]} words - ソート対象の単語リスト
 * @param {boolean} ascending - trueなら昇順、falseなら降順
 * @returns {string[]} ソートされた単語リスト
 */
export function sortWordsByUniqueConsonantCount(words, ascending = false) {
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    return words.slice().sort((a, b) => {
        const countA = new Set(a.split('').filter(char => consonants.includes(char))).size;
        const countB = new Set(b.split('').filter(char => consonants.includes(char))).size;
        const diff = countA - countB;
        if (ascending) {
            return diff;
    }
        return -diff;
    });
}
