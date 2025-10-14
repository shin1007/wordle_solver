// 'https://gist.githubusercontent.com/dracos/dd0668f281e685bad51479e5acaadb93/raw/6bfa15d263d6d5b63840a8e5b64e04b382fdb079/valid-wordle-words.txt'

export const CONSONANT_SCORES = {
    's': 21, 'r': 20, 'l': 19, 't': 18, 'n': 17, 'd': 16, 'y': 15, 'm': 14, 'p': 13, 'c': 12,
    'h': 11, 'g': 10, 'b': 9, 'k': 8, 'w': 7, 'f': 6, 'v': 5, 'z': 4, 'j': 3, 'x': 2, 'q': 1
};

export const VOWEL_SCORES = {
    'e': 5, 'a': 4, 'o': 3, 'i': 2, 'u': 1
};

// #2
// 母音の出現頻度をカウント
// 同じ単語内に複数回登場する際は1回とする
// 昇順
export function sortByUniqueVowel(words, ascending = true) {
    const vowelCount = {};
    const vowels = 'aeiou';
    words.forEach(word => {
        const uniqueVowels = new Set(word.split('').filter(char => vowels.includes(char)));
        uniqueVowels.forEach(vowel => {
            vowelCount[vowel] = (vowelCount[vowel] || 0) + 1;
        });
    });
    // 出現頻度でソート
    const sortedVowels = Object.entries(vowelCount)
        .sort((a, b) => a[1] - b[1])
        .map(entry => entry[0]);
    if (ascending) {
        return sortedVowels;
    }
    sortedVowels.reverse();
    return sortedVowels;
}

// #2
// 母音スコアの合計でソート
export function sortWordsByVowelScore(words, ascending = true) {
    return words.slice().sort((a, b) => {
        const scoreA = a.split('').reduce((sum, char) => sum + (VOWEL_SCORES[char] || 0), 0);
        const scoreB = b.split('').reduce((sum, char) => sum + (VOWEL_SCORES[char] || 0), 0);
        if (ascending) {
            return scoreA - scoreB; // 昇順
        }
        return -(scoreB - scoreA); // 昇順
    });
}

// #3
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

// #4
// 子音の出現頻度をカウント
// 同じ単語内に複数回登場する際は1回とする
// 降順
export function sortByConsonantCount(words, ascending = false) {
    const consonantCount = {};
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    words.forEach(word => {
        const uniqueConsonants = new Set(word.split('').filter(char => consonants.includes(char)));
        uniqueConsonants.forEach(char => {
            consonantCount[char] = (consonantCount[char] || 0) + 1;
        });
    });
    // 出現頻度でソート
    const sortedConsonants = Object.entries(consonantCount)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
        if (ascending) {
        return sortedConsonants;
    }
    sortedConsonants.reverse();
    return sortedConsonants;
}
