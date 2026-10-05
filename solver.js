import { ANSWERS, ALLOWED } from './words.js';

// フィードバックは 3進数 5桁で表す（i文字目の重み 3^i, 0=灰 1=黄 2=緑）
export const ALL_GREEN = 242;
const PATTERN_COUNT = 243;
const CODE_A = 'a'.charCodeAt(0);

// 探索パラメータ（rank の params で上書きできる）
export const DEFAULT_PARAMS = {
    topK: 30,          // 先読みで厳密評価する上位候補数（トップレベル）
    innerK: 8,         // 先読みで厳密評価する上位候補数（部分問題）
    extraPool: 100,    // 部分問題で候補単語以外に試す推測語の数
    rolloutMax: 20,    // 先読みの末端でも、残りがこの語数以下なら最後まで（貪欲に）解いて手数を数える
    maxGuesses: 6,     // Wordleの手数上限
    failPenalty: 3,    // 上限を超える1手ごとのペナルティ（失敗しにくい手を優先する）
    tailTurn: 4,       // この手数を超える推測に tailPenalty を加える（5手以上かかる展開を避ける）
    tailPenalty: 0.2,
    depth2Max: 50,     // 候補がこの語数以下なら2段先まで読む
    depth1Max: 300,    // 候補がこの語数以下なら1段先まで読む
    // 1文字違いの塊（_ATCH など）が推測後も分かれずに残る場合の補正の重み（0で無効）
    clusterWeightNormal: 1,
    clusterWeightHard: 1,
};

/** 1文字違いの s 語が塊のまま残ったとき、1語ずつ試すしかない場合の手数と見積もりの差 */
function clusterExtra(s) {
    return Math.max(0, (s + 1) / 2 - estimateCost(s));
}

/**
 * 残り k 語を解くのに必要な推測回数の見積もり（次の1手を含む）。
 * 1語なら1手、2語なら 1.5 手、それ以上は経験的な近似式。
 */
function estimateCost(k) {
    if (k <= 1) return 1;
    if (k === 2) return 1.5;
    return 1.6 + 0.24 * Math.log(k);
}

/** 色の配列（'gray' | 'yellow' | 'green'）をパターン番号に変換 */
export function colorsToPattern(colors) {
    const value = { gray: 0, yellow: 1, green: 2 };
    let p = 0;
    for (let i = 4; i >= 0; i--) p = p * 3 + value[colors[i]];
    return p;
}

export class Solver {
    constructor(answers = ANSWERS, allowed = ALLOWED) {
        this.words = [...answers, ...allowed];
        this.answerCount = answers.length;
        this.index = new Map(this.words.map((w, i) => [w, i]));
        this.codes = new Uint8Array(this.words.length * 5);
        this.words.forEach((w, i) => {
            for (let j = 0; j < 5; j++) this.codes[i * 5 + j] = w.charCodeAt(j) - CODE_A;
        });
        this.letterCount = new Int8Array(26);
        this.patternScratch = new Int16Array(this.words.length);
        this.bucketSizes = new Int32Array(PATTERN_COUNT);
        this._cache = null;
        this.params = DEFAULT_PARAMS;
    }

    /** これまで turn 手使った状態から k 語を解く見積もり手数（ペナルティ込み） */
    leafCost(k, turn) {
        const { maxGuesses, failPenalty, tailTurn, tailPenalty } = this.params;
        const base = estimateCost(k);
        const end = turn + base;
        let cost = base;
        if (end > maxGuesses) cost += (end - maxGuesses) * failPenalty;
        if (end > tailTurn) cost += (end - tailTurn) * tailPenalty;
        return cost;
    }

    /** turn 手目の推測そのもののコスト */
    guessCost(turn) {
        const { maxGuesses, failPenalty, tailTurn, tailPenalty } = this.params;
        return 1 + (turn > maxGuesses ? failPenalty : 0) + (turn > tailTurn ? tailPenalty : 0);
    }

    /**
     * 1文字違いの単語の塊（1か所以外の4文字が同じ位置で一致する3語以上）を列挙する。
     * 戻り値は cands 内の添字の配列の配列。
     */
    clusters(cands) {
        const c = this.codes;
        const result = [];
        for (let i = 0; i < 5; i++) {
            const groups = new Map();
            cands.forEach((a, idx) => {
                let key = 0;
                for (let j = 0; j < 5; j++) if (j !== i) key = key * 26 + c[a * 5 + j];
                const group = groups.get(key);
                if (group) group.push(idx);
                else groups.set(key, [idx]);
            });
            for (const group of groups.values()) if (group.length >= 3) result.push(group);
        }
        return result;
    }

    /** 推測語 g を出したとき、正解が a なら返ってくるパターン（重複文字もWordleと同じ規則） */
    feedback(g, a) {
        const c = this.codes, cnt = this.letterCount;
        const gi = g * 5, ai = a * 5;
        let greens = 0;
        for (let i = 0; i < 5; i++) {
            if (c[gi + i] === c[ai + i]) greens |= 1 << i;
            else cnt[c[ai + i]]++;
        }
        // 黄色は左から順に、正解側で余っている文字数の分だけ付く
        let p = 0;
        for (let i = 0, w = 1; i < 5; i++, w *= 3) {
            if (greens & (1 << i)) p += 2 * w;
            else {
                const l = c[gi + i];
                if (cnt[l] > 0) { p += w; cnt[l]--; }
            }
        }
        for (let i = 0; i < 5; i++) cnt[c[ai + i]] = 0;
        return p;
    }

    /** 先読み中は (推測語, 候補) のフィードバックを推測語ごとにキャッシュして再利用する */
    _startCache(cands) {
        const col = new Int32Array(this.words.length).fill(-1);
        cands.forEach((a, i) => { col[a] = i; });
        this._cache = { cands, col, rows: new Map() };
    }

    _cachedFeedback(g, a) {
        const cache = this._cache;
        if (!cache || cache.col[a] < 0) return this.feedback(g, a);
        let row = cache.rows.get(g);
        if (!row) {
            row = new Uint8Array(cache.cands.length);
            cache.cands.forEach((c, i) => { row[i] = this.feedback(g, c); });
            cache.rows.set(g, row);
        }
        return row[cache.col[a]];
    }

    /** 履歴 [{word, pattern}] と矛盾しない単語番号の配列（基本は正解リストから） */
    candidates(history) {
        const ids = history.map(h => ({ g: this.index.get(h.word), p: h.pattern }))
            .filter(h => h.g !== undefined);
        const match = a => ids.every(h => this.feedback(h.g, a) === h.p);
        const result = [];
        for (let a = 0; a < this.answerCount; a++) if (match(a)) result.push(a);
        if (result.length > 0) return result;
        // 正解リストに無い単語が答えの場合に備え、入力可能単語にフォールバック
        for (let a = this.answerCount; a < this.words.length; a++) if (match(a)) result.push(a);
        return result;
    }

    // ---- ハードモードの制約 ----

    /** 制約 {green: Int8Array(5), min: Int8Array(26)} に (推測語, パターン) の情報を加えた新しい制約 */
    addConstraint(cons, g, pattern) {
        const green = Int8Array.from(cons.green);
        const min = Int8Array.from(cons.min);
        const seen = new Int8Array(26);
        for (let i = 0, p = pattern; i < 5; i++, p = Math.floor(p / 3)) {
            const v = p % 3, l = this.codes[g * 5 + i];
            if (v === 2) green[i] = l;
            if (v > 0) seen[l]++;
        }
        for (let l = 0; l < 26; l++) if (seen[l] > min[l]) min[l] = seen[l];
        return { green, min };
    }

    emptyConstraint() {
        return { green: new Int8Array(5).fill(-1), min: new Int8Array(26) };
    }

    /** ハードモードで単語 g が入力可能か（緑は同じ位置、黄・緑の文字は必要数含む） */
    hardOk(g, cons) {
        const c = this.codes;
        for (let i = 0; i < 5; i++) {
            if (cons.green[i] >= 0 && c[g * 5 + i] !== cons.green[i]) return false;
        }
        const cnt = new Int8Array(26);
        for (let i = 0; i < 5; i++) cnt[c[g * 5 + i]]++;
        for (let l = 0; l < 26; l++) if (cnt[l] < cons.min[l]) return false;
        return true;
    }

    // ---- 評価 ----

    /** これまで turn 手使った状態で推測語 g を出したときの見積もり平均手数（1パス・先読みなし） */
    heuristic(g, cands, turn, useCache = false, clusters = null) {
        const sizes = this.bucketSizes, pats = this.patternScratch;
        const touched = [];
        for (let i = 0; i < cands.length; i++) {
            const p = useCache ? this._cachedFeedback(g, cands[i]) : this.feedback(g, cands[i]);
            pats[i] = p;
            if (sizes[p]++ === 0) touched.push(p);
        }
        const n = cands.length;
        let total = 0, entropy = 0;
        for (const p of touched) {
            const k = sizes[p];
            sizes[p] = 0;
            entropy -= (k / n) * Math.log2(k / n);
            if (p === ALL_GREEN) continue;
            total += k * this.leafCost(k, turn + 1);
        }
        if (clusters) total += this.clusterWeight * this._clusterPenalty(clusters, pats);
        return { expected: this.guessCost(turn + 1) + total / n, entropy };
    }

    /** 推測後も同じパターンにまとまって残る、塊の語に対する追加手数の合計 */
    _clusterPenalty(clusters, pats) {
        let penalty = 0;
        for (const group of clusters) {
            // 塊の中で同じパターンになった語の数を数える（塊は小さいので総当たり）
            for (let x = 0; x < group.length; x++) {
                const p = pats[group[x]];
                if (p === ALL_GREEN) continue;
                let same = 0, first = true;
                for (let y = 0; y < group.length; y++) {
                    if (pats[group[y]] !== p) continue;
                    if (y < x) { first = false; break; }
                    same++;
                }
                if (first && same >= 3) penalty += same * clusterExtra(same);
            }
        }
        return penalty;
    }

    /** 推測語 g で候補を分割したバケツ（パターン → 単語番号配列） */
    partition(g, cands) {
        const buckets = new Map();
        for (const a of cands) {
            const p = this._cachedFeedback(g, a);
            let b = buckets.get(p);
            if (!b) buckets.set(p, b = []);
            b.push(a);
        }
        return buckets;
    }

    /** 推測語を見積もり順に並べる（同点なら候補単語・エントロピー優先） */
    _scorePool(pool, cands, turn, useCache = false) {
        const candSet = new Set(cands);
        const clusters = this.clusterWeight > 0 ? this.clusters(cands) : [];
        const useClusters = clusters.length > 0 ? clusters : null;
        return pool.map(g => ({ g, isCandidate: candSet.has(g), ...this.heuristic(g, cands, turn, useCache, useClusters) }))
            .sort((x, y) => x.expected - y.expected
                || (y.isCandidate - x.isCandidate)
                || (y.entropy - x.entropy));
    }

    /**
     * 推測語 g を出した場合の平均手数を、決定木を depth 段まで先読みして求める。
     * hard: ハードモード, cons: 現在の制約, extra: 部分問題で試す追加の推測語, turn: これまでの手数
     */
    _expectedWithLookahead(g, cands, depth, hard, cons, extra, turn) {
        const n = cands.length;
        let total = 0;
        for (const [p, bucket] of this.partition(g, cands)) {
            if (p === ALL_GREEN) continue;
            if (bucket.length === n) return Infinity; // 何も絞り込めない推測
            const nextCons = hard ? this.addConstraint(cons, g, p) : cons;
            total += bucket.length * this._solveCost(bucket, depth, hard, nextCons, extra, turn + 1);
        }
        return this.guessCost(turn + 1) + total / n;
    }

    /** 候補 cands を解き切るまでの平均手数（次の1手を含む）の最小値 */
    _solveCost(cands, depth, hard, cons, extra, turn) {
        const n = cands.length;
        if (n <= 2) return this.leafCost(n, turn);
        const pool = [...new Set([...cands, ...extra])]
            .filter(g => !hard || this.hardOk(g, cons));
        const scored = this._scorePool(pool, cands, turn, true);
        if (depth <= 0) {
            // 少数なら最後まで解いてみる（ハードモードの _OUND のような罠を見抜くため）
            if (n <= this.params.rolloutMax) return this._expectedWithLookahead(scored[0].g, cands, 0, hard, cons, extra, turn);
            return scored[0].expected;
        }
        let best = Infinity;
        for (const s of scored.slice(0, this.params.innerK)) {
            best = Math.min(best, this._expectedWithLookahead(s.g, cands, depth - 1, hard, cons, extra, turn));
        }
        return best;
    }

    /**
     * 次に入力すべき単語のランキングを返す。
     * history: [{word, pattern}], hard: ハードモードか, limit: 返す件数, depth: 先読みの深さ（省略時は候補数で自動）,
     * params: 探索パラメータの上書き, book: ハードモードの定跡（book.js の HARD_BOOK）
     * 戻り値: { candidates: string[], ranking: [{word, expected, isCandidate}] }
     */
    rank(history, { hard = false, limit = 30, depth, params, book } = {}) {
        this.params = { ...DEFAULT_PARAMS, ...params };
        this.clusterWeight = hard ? this.params.clusterWeightHard : this.params.clusterWeightNormal;
        const cands = this.candidates(history);
        if (cands.length === 0) return { candidates: [], ranking: [] };

        let cons = this.emptyConstraint();
        for (const h of history) {
            const g = this.index.get(h.word);
            if (g !== undefined) cons = this.addConstraint(cons, g, h.pattern);
        }

        let pool = this.words.map((_, i) => i);
        if (hard) pool = pool.filter(g => this.hardOk(g, cons));

        const turn = history.length;
        const scored = this._scorePool(pool, cands, turn);
        if (cands.length > 2) {
            // 上位候補は決定木を先読みして平均手数を精密化（候補が少ないほど深く読む）
            const n = cands.length;
            if (depth === undefined) depth = n <= this.params.depth2Max ? 2 : n <= this.params.depth1Max ? 1 : 0;
            const extra = scored.slice(0, this.params.extraPool).map(s => s.g);
            const top = scored.slice(0, this.params.topK);
            this._startCache(cands);
            try {
                for (const s of top) {
                    s.expected = this._expectedWithLookahead(s.g, cands, depth, hard, cons, extra, turn);
                }
            } finally {
                this._cache = null;
            }
            top.sort((x, y) => x.expected - y.expected
                || (y.isCandidate - x.isCandidate)
                || (y.entropy - x.entropy));
            scored.splice(0, top.length, ...top);
        }

        // 定跡（事前に最後まで解かせて選んだ2語目）があれば先頭にする
        const entry = book && hard && history.length === 1 && history[0].word === book.opener
            ? book.second[history[0].pattern] : null;
        const bookIndex = entry ? scored.findIndex(s => this.words[s.g] === entry.word) : -1;
        if (bookIndex >= 0) {
            const [s] = scored.splice(bookIndex, 1);
            scored.unshift({ ...s, expected: entry.expected, fromBook: true });
        }

        const toResult = s => ({
            word: this.words[s.g],
            expected: s.expected,
            isCandidate: s.isCandidate,
            fromBook: !!s.fromBook,
        });
        // 候補単語はランキング順に並べる
        const candidates = scored.filter(s => s.isCandidate).map(s => this.words[s.g]);
        return { candidates, ranking: scored.slice(0, limit).map(toResult) };
    }
}
