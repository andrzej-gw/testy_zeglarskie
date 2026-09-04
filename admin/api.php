<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_DB_BYTES = 15_000_000;
$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$dbFile = getenv('JSM_REVIEW_DB') ?: ($dataDir . DIRECTORY_SEPARATOR . 'reviews.json');

function respond(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ensureStorage(string $dataDir, string $dbFile): void {
    if (!is_dir($dataDir) && !mkdir($dataDir, 0770, true) && !is_dir($dataDir)) {
        respond(['ok' => false, 'error' => 'Nie można utworzyć katalogu danych.'], 500);
    }
    if (!file_exists($dbFile)) {
        if (file_put_contents($dbFile, "[]\n", LOCK_EX) === false) {
            respond(['ok' => false, 'error' => 'Nie można utworzyć bazy opinii. Sprawdź uprawnienia katalogu admin/data.'], 500);
        }
    }
}

function readDb(string $dbFile): array {
    $fh = fopen($dbFile, 'c+');
    if (!$fh) respond(['ok' => false, 'error' => 'Nie można otworzyć bazy opinii.'], 500);
    try {
        if (!flock($fh, LOCK_SH)) respond(['ok' => false, 'error' => 'Nie można zablokować bazy do odczytu.'], 500);
        rewind($fh);
        $raw = stream_get_contents($fh);
        flock($fh, LOCK_UN);
    } finally {
        fclose($fh);
    }
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function mutateDb(string $dbFile, callable $mutator): array {
    $fh = fopen($dbFile, 'c+');
    if (!$fh) respond(['ok' => false, 'error' => 'Nie można otworzyć bazy opinii.'], 500);
    try {
        if (!flock($fh, LOCK_EX)) respond(['ok' => false, 'error' => 'Nie można zablokować bazy do zapisu.'], 500);
        rewind($fh);
        $raw = stream_get_contents($fh);
        $data = ($raw && trim($raw) !== '') ? json_decode($raw, true) : [];
        if (!is_array($data)) $data = [];
        $data = $mutator($data);
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || strlen($json) > MAX_DB_BYTES) {
            respond(['ok' => false, 'error' => 'Baza opinii przekroczyła dozwolony rozmiar.'], 507);
        }
        rewind($fh);
        ftruncate($fh, 0);
        if (fwrite($fh, $json . "\n") === false) respond(['ok' => false, 'error' => 'Błąd zapisu bazy opinii.'], 500);
        fflush($fh);
        flock($fh, LOCK_UN);
        return $data;
    } finally {
        fclose($fh);
    }
}

function boolInt(mixed $value, string $field): int {
    if ($value === 0 || $value === '0' || $value === false) return 0;
    if ($value === 1 || $value === '1' || $value === true) return 1;
    respond(['ok' => false, 'error' => "Nieprawidłowe pole: $field"], 422);
}

function cleanText(mixed $value, int $max): string {
    $text = trim((string)($value ?? ''));
    if (function_exists('mb_strlen')) {
        if (mb_strlen($text, 'UTF-8') > $max) $text = mb_substr($text, 0, $max, 'UTF-8');
    } elseif (strlen($text) > $max) {
        $text = substr($text, 0, $max);
    }
    return $text;
}

ensureStorage($dataDir, $dbFile);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'reviews';

if ($method === 'GET' && $action === 'reviews') {
    $qid = filter_input(INPUT_GET, 'question_id', FILTER_VALIDATE_INT);
    if (!$qid || $qid < 1) respond(['ok' => false, 'error' => 'Brak poprawnego question_id.'], 400);
    $rows = array_values(array_filter(readDb($dbFile), fn($r) => (int)($r['question_id'] ?? 0) === $qid));
    usort($rows, fn($a, $b) => strcmp((string)($b['created_at'] ?? ''), (string)($a['created_at'] ?? '')));
    respond(['ok' => true, 'reviews' => $rows]);
}

if ($method === 'GET' && $action === 'summary') {
    $summary = [];
    foreach (readDb($dbFile) as $row) {
        $qid = (int)($row['question_id'] ?? 0);
        if ($qid < 1) continue;
        if (!isset($summary[$qid])) {
            $summary[$qid] = [
                'count' => 0,
                'approved' => 0,
                'needs_changes' => 0,
                'delete' => 0,
                'rating_sum' => 0,
            ];
        }
        $status = (string)($row['status'] ?? '');
        if (!in_array($status, ['approved', 'needs_changes', 'delete'], true)) continue;
        $summary[$qid]['count']++;
        $summary[$qid][$status]++;
        $summary[$qid]['rating_sum'] += (int)($row['coolness'] ?? 0);
    }
    foreach ($summary as &$s) {
        $s['avg_rating'] = $s['count'] ? round($s['rating_sum'] / $s['count'], 2) : null;
        unset($s['rating_sum']);
    }
    unset($s);
    respond(['ok' => true, 'summary' => $summary]);
}

if ($method === 'POST') {
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['jsm_admin_csrf']) || !hash_equals($_SESSION['jsm_admin_csrf'], $csrfHeader)) {
        respond(['ok' => false, 'error' => 'Nieprawidłowy token sesji. Odśwież stronę.'], 403);
    }

    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload)) respond(['ok' => false, 'error' => 'Nieprawidłowe dane JSON.'], 400);

    $qid = filter_var($payload['question_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$qid || $qid < 1) respond(['ok' => false, 'error' => 'Nieprawidłowy numer pytania.'], 422);

    $name = cleanText($payload['reviewer_name'] ?? '', 120);
    if ($name === '') respond(['ok' => false, 'error' => 'Imię / podpis jest wymagane.'], 422);
    $contact = cleanText($payload['contact'] ?? '', 180);
    $status = cleanText($payload['status'] ?? '', 32);
    if (!in_array($status, ['approved', 'needs_changes', 'delete'], true)) {
        respond(['ok' => false, 'error' => 'Wybierz status pytania.'], 422);
    }
    $coolness = filter_var($payload['coolness'] ?? null, FILTER_VALIDATE_INT);
    if (!$coolness || $coolness < 1 || $coolness > 5) respond(['ok' => false, 'error' => 'Ocena musi być od 1 do 5.'], 422);

    $review = [
        'id' => bin2hex(random_bytes(8)),
        'question_id' => (int)$qid,
        'reviewer_name' => $name,
        'contact' => $contact,
        'status' => $status,
        'coolness' => (int)$coolness,
        'changes' => [
            'text' => $status === 'needs_changes' && !empty($payload['changes']['text']),
            'image' => $status === 'needs_changes' && !empty($payload['changes']['image']),
            'answer_a' => $status === 'needs_changes' && !empty($payload['changes']['answer_a']),
            'answer_b' => $status === 'needs_changes' && !empty($payload['changes']['answer_b']),
            'answer_c' => $status === 'needs_changes' && !empty($payload['changes']['answer_c']),
            'difficulty' => $status === 'needs_changes' && !empty($payload['changes']['difficulty']),
            'category' => $status === 'needs_changes' && !empty($payload['changes']['category']),
            'explanation' => $status === 'needs_changes' && !empty($payload['changes']['explanation']),
        ],
        'change_details' => $status === 'needs_changes' ? cleanText($payload['change_details'] ?? '', 4000) : '',
        'general_comment' => cleanText($payload['general_comment'] ?? '', 6000),
        'created_at' => gmdate('c'),
    ];

    mutateDb($dbFile, function(array $data) use ($review): array {
        $data[] = $review;
        return $data;
    });
    respond(['ok' => true, 'review' => $review], 201);
}

respond(['ok' => false, 'error' => 'Nieobsługiwana operacja.'], 405);
