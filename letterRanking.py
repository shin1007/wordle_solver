import requests
from collections import Counter
from typing import List, Dict

# 単語リストをキャッシュするためのグローバル変数
_word_list: List[str] = []
WORD_LIST_URL = 'https://gist.githubusercontent.com/dracos/dd0668f281e685bad51479e5acaadb93/raw/6bfa15d263d6d5b63840a8e5b64e04b382fdb079/valid-wordle-words.txt'

def get_word_list() -> List[str]:
    """
    Wordleの単語リストを取得し、キャッシュします。
    2回目以降の呼び出しではキャッシュされたリストを返します。
    """
    global _word_list
    if _word_list:
        return _word_list

    try:
        response = requests.get(WORD_LIST_URL)
        response.raise_for_status()  # HTTPエラーがあれば例外を発生させる
        
        # テキストを改行で分割し、各単語の前後の空白を削除し、5文字の単語のみをフィルタリング
        words = [
            word.strip() for word in response.text.splitlines() 
            if len(word.strip()) == 5
        ]
        _word_list = words
        return _word_list
    except requests.exceptions.RequestException as e:
        print(f"単語リストの取得に失敗しました: {e}")
        return []

def _rank_letters(words: List[str], letters_to_check: str) -> List[str]:
    """
    指定された文字セット（母音または子音）の出現頻度を計算し、
    ランキング順にソートされたリストを返します。
    """
    letter_counts = Counter()
    for word in words:
        # 単語内のユニークな文字のみをカウント対象とする
        unique_letters_in_word = set(char for char in word if char in letters_to_check)
        letter_counts.update(unique_letters_in_word)
    
    # 出現頻度が高い順に文字をソート
    # Counter.most_common() は (要素, カウント) のタプルリストを返す
    sorted_letters = [letter for letter, count in letter_counts.most_common()]
    return sorted_letters

def consonant_ranking(words: List[str]) -> List[str]:
    """子音の出現頻度ランキングを返します。"""
    consonants = "bcdfghjklmnpqrstvwxyz"
    return _rank_letters(words, consonants)

def vowel_ranking(words: List[str]) -> List[str]:
    """母音の出現頻度ランキングを返します。"""
    vowels = "aeiou"
    return _rank_letters(words, vowels)

def get_letter_ranking() -> Dict[str, List[str]]:
    """
    単語リストを取得し、子音と母音の出現頻度ランキングを計算します。
    """
    words = get_word_list()
    if not words:
        return {"consonants": [], "vowels": []}
        
    consonants = consonant_ranking(words)
    print('Consonant Ranking:', consonants)
    
    vowels = vowel_ranking(words)
    print('Vowel Ranking:', vowels)

    return {"consonants": consonants, "vowels": vowels}

if __name__ == '__main__':
    # このファイルが直接実行された場合にのみ、以下の処理を行う
    get_letter_ranking()
