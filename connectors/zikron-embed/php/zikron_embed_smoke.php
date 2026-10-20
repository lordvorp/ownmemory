<?php
// connectors/zikron-embed/php/zikron_embed_smoke.php
require __DIR__ . '/Zikron_Embed.php';
putenv('ZIKRON_EMBED_URL=http://127.0.0.1:18791');
putenv('ZIKRON_EMBED_GPU_URL='); // force sidecar
$v = Zikron_Embed::document('Zikron embedder check');
if ($v === null || count($v) !== 384) {
    fwrite(STDERR, "embed failed\n");
    exit(1);
}
echo "ok dims=" . count($v) . "\n";
