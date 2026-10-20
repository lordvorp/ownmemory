<?php
/**
 * Reference Zikron embed client — OwnMemory sidecar + optional cypher GPU.
 * GPL-2.0-only. Copy into the Zikron plugin and replace file_get_contents
 * with wp_remote_post when inside WordPress.
 */
declare(strict_types=1);

final class Zikron_Embed
{
    private const PREFIX = 'Represent this sentence for searching relevant passages: ';
    private const PROBE = 'Zikron embedder check';
    private const DIMS = 384;

    /** @var bool|null null = not probed yet */
    private static ?bool $useGpu = null;

    public static function document(string $text): ?array
    {
        return self::embed($text, 'document');
    }

    public static function query(string $text): ?array
    {
        return self::embed($text, 'query');
    }

    public static function probeAndLock(): void
    {
        if (self::$useGpu !== null) {
            return;
        }
        $gpuBase = getenv('ZIKRON_EMBED_GPU_URL') ?: '';
        if ($gpuBase === '') {
            self::$useGpu = false;
            return;
        }
        $side = self::callSidecar(self::PROBE, 'document');
        $gpu = self::callCypher(self::PROBE, 'document');
        if ($side === null || $gpu === null) {
            self::$useGpu = false;
            return;
        }
        self::$useGpu = self::cosine($side, $gpu) >= 0.98;
    }

    private static function embed(string $text, string $role): ?array
    {
        self::probeAndLock();
        if (self::$useGpu) {
            $v = self::callCypher($text, $role);
            if ($v !== null) {
                return $v;
            }
        }
        return self::callSidecar($text, $role);
    }

    private static function callSidecar(string $text, string $role): ?array
    {
        $base = rtrim(getenv('ZIKRON_EMBED_URL') ?: 'http://embed:8791', '/');
        $payload = json_encode(['text' => $text, 'role' => $role]);
        $raw = self::httpPost($base . '/v1/embed', $payload);
        if ($raw === null) {
            return null;
        }
        $j = json_decode($raw, true);
        if (!is_array($j) || !isset($j['embedding']) || !is_array($j['embedding'])) {
            return null;
        }
        if (count($j['embedding']) !== self::DIMS) {
            return null;
        }
        return array_map('floatval', $j['embedding']);
    }

    private static function callCypher(string $text, string $role): ?array
    {
        $base = rtrim(getenv('ZIKRON_EMBED_GPU_URL') ?: '', '/');
        if ($base === '') {
            return null;
        }
        $input = $role === 'query' ? self::PREFIX . $text : $text;
        $payload = json_encode([
            'model' => 'snowflake-arctic-embed:33m',
            'input' => $input,
        ]);
        $raw = self::httpPost($base . '/api/embed', $payload);
        if ($raw === null) {
            return null;
        }
        $j = json_decode($raw, true);
        $emb = $j['embeddings'][0] ?? $j['embedding'] ?? null;
        if (!is_array($emb) || count($emb) !== self::DIMS) {
            return null;
        }
        return array_map('floatval', $emb);
    }

    private static function httpPost(string $url, string $json): ?string
    {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $json,
                'timeout' => 60,
                'ignore_errors' => true,
            ],
        ]);
        $raw = @file_get_contents($url, false, $ctx);
        return $raw === false ? null : $raw;
    }

    /** @param list<float> $a @param list<float> $b */
    private static function cosine(array $a, array $b): float
    {
        $dot = 0.0;
        $na = 0.0;
        $nb = 0.0;
        $n = min(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
            $na += $a[$i] * $a[$i];
            $nb += $b[$i] * $b[$i];
        }
        if ($na <= 0.0 || $nb <= 0.0) {
            return 0.0;
        }
        return $dot / (sqrt($na) * sqrt($nb));
    }
}
