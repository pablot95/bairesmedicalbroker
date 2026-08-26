<?php
declare(strict_types=1);

const DESTINO_CONSULTAS = 'Bairesmedicalbroker@gmail.com';

function responder(int $status, bool $ok, string $message): never
{
    http_response_code($status);
    $accept = (string)($_SERVER['HTTP_ACCEPT'] ?? '');
    if (str_contains($accept, 'application/json')) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=UTF-8');
    $title = $ok ? 'Consulta enviada' : 'No pudimos enviar la consulta';
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' . $safeTitle . '</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f9fd;color:#10142c;font:18px/1.6 system-ui,sans-serif}.card{width:min(560px,calc(100% - 32px));background:#fff;border:1px solid #dde8f2;border-radius:18px;padding:32px;box-sizing:border-box;box-shadow:0 18px 50px #2410631f}h1{margin-top:0}a{display:inline-block;margin-top:12px;color:#371a94;font-weight:700}</style></head><body><main class="card"><h1>' . $safeTitle . '</h1><p>' . $safeMessage . '</p><a href="./#inicio">Volver al sitio</a></main></body></html>';
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder(405, false, 'Método no permitido.');
}

/* Campo señuelo: los visitantes reales nunca lo ven ni lo completan. */
if (trim((string)($_POST['empresa'] ?? '')) !== '') {
    responder(200, true, '¡Listo! Recibimos tus datos y te vamos a contactar.');
}

$nombre = trim((string)($_POST['nombre'] ?? ''));
$telefono = trim((string)($_POST['telefono'] ?? ''));
$cobertura = trim((string)($_POST['cobertura'] ?? ''));
$situacion = trim((string)($_POST['situacion'] ?? ''));
$consentimiento = (string)($_POST['consentimiento'] ?? '');

$coberturasValidas = ['Para mí', 'Para mí y mi pareja', 'Para mí, mi pareja y mis hijos'];
$situacionesValidas = ['Monotributista', 'Relación de dependencia', 'Particular'];
$digitosTelefono = preg_replace('/\D+/', '', $telefono) ?? '';

if ($nombre === '' || strlen($nombre) > 80 || !preg_match('/^[\p{L}\p{M}\s\'\-.]+$/u', $nombre)) {
    responder(422, false, 'Revisá el nombre y apellido ingresados.');
}
if (!in_array($cobertura, $coberturasValidas, true)) {
    responder(422, false, 'Elegí para quién sería la cobertura.');
}
if (!in_array($situacion, $situacionesValidas, true)) {
    responder(422, false, 'Elegí tu situación laboral.');
}
if (strlen($digitosTelefono) < 8 || strlen($digitosTelefono) > 15 || !preg_match('/^[+\d\s()\-.]+$/', $telefono)) {
    responder(422, false, 'Revisá el teléfono ingresado.');
}
if ($consentimiento !== 'si') {
    responder(422, false, 'Necesitamos tu autorización para poder contactarte.');
}

session_name('bmb_consultas');
session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
if (isset($_SESSION['ultima_consulta']) && time() - (int)$_SESSION['ultima_consulta'] < 20) {
    responder(429, false, 'Esperá unos segundos antes de volver a enviar el formulario.');
}

$host = (string)parse_url('http://' . (string)($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
if (!filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) || $host === 'localhost') {
    $host = 'gokywebs.com';
}
$remitente = 'formularios@' . $host;
$asunto = 'Nueva consulta web - Baires Medical Brokers';
$cuerpo = implode("\r\n", [
    'Nueva consulta recibida desde el formulario del inicio.',
    '',
    'Nombre y apellido: ' . $nombre,
    'Teléfono: ' . $telefono,
    'Cobertura para: ' . $cobertura,
    'Situación laboral: ' . $situacion,
    '',
    'Fecha: ' . date('d/m/Y H:i:s'),
]);
$headers = implode("\r\n", [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Baires Medical Brokers <' . $remitente . '>',
    'Reply-To: ' . DESTINO_CONSULTAS,
    'X-Mailer: PHP/' . PHP_VERSION,
]);

if (!@mail(DESTINO_CONSULTAS, $asunto, $cuerpo, $headers)) {
    responder(500, false, 'No pudimos enviar el formulario en este momento.');
}

$_SESSION['ultima_consulta'] = time();
responder(200, true, '¡Listo! Recibimos tus datos y te vamos a contactar.');
