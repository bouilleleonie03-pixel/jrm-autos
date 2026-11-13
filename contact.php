<?php
/**
 * JRM AUTOS — Traitement du formulaire de contact
 * Compatible hébergement mutualisé Hostinger (fonction mail() de PHP).
 *
 * ┌──────────────────────── CONFIGURATION ────────────────────────┐
 * │ 1. DESTINATAIRE : adresse qui reçoit les demandes.            │
 * │ 2. EXPEDITEUR   : adresse e-mail créée sur VOTRE domaine dans │
 * │    hPanel > E-mails (ex. contact@votre-domaine.fr).           │
 * │    Hostinger refuse ou classe en spam les e-mails envoyés     │
 * │    depuis une adresse qui n'appartient pas au domaine.        │
 * └───────────────────────────────────────────────────────────────┘
 */
const DESTINATAIRE = 'jrm.autos33@gmail.com';
const EXPEDITEUR   = 'contact@votre-domaine.fr';   // ← À REMPLACER
const NOM_SITE     = 'Site JRM Autos';

/* ------------------------------------------------------------------ */

date_default_timezone_set('Europe/Paris');
header('X-Content-Type-Options: nosniff');
$wantsJson = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

function reply($ok, $message, $wantsJson)
{
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: ' . ($ok ? 'merci.html' : 'contact.html?erreur=1#formulaire'), true, 303);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: contact.html', true, 303);
    exit;
}

/* Anti-spam 1 : champ piège invisible (doit rester vide) */
if (!empty($_POST['site_web'])) {
    reply(true, 'Merci.', $wantsJson); // on ne signale rien au robot
}

/* Anti-spam 2 : délai minimum de remplissage (3 s) */
$ts = isset($_POST['_ts']) ? (int) $_POST['_ts'] : 0;
if ($ts > 0 && (time() - $ts) < 3) {
    reply(false, 'Envoi trop rapide, merci de réessayer.', $wantsJson);
}

/* Nettoyage */
function field($key, $max = 200)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $v = str_replace(["\r", "\0"], '', $v);
    return mb_substr($v, 0, $max, 'UTF-8');
}
function oneLine($v)
{
    return preg_replace('/[\n\t]+/', ' ', $v);
}

$nom       = oneLine(field('nom', 100));
$telephone = oneLine(field('telephone', 30));
$email     = oneLine(field('email', 150));
$objet     = oneLine(field('objet', 80));
$vehicule  = oneLine(field('vehicule', 120));
$message   = field('message', 4000);
$isLocation = (isset($_POST['formulaire']) && $_POST['formulaire'] === 'location');
$dateDepart = oneLine(field('date_depart', 10));
$dateRetour = oneLine(field('date_retour', 10));

$objetsAutorises = [
    'Mécanique et entretien', 'Diagnostic automobile', 'Carrosserie', 'Vitrage automobile',
    'Carte grise', 'Gardiennage', 'Prêt de véhicule', 'Location Renault Trafic', 'Véhicule BMW', 'Autre demande',
];
if (!in_array($objet, $objetsAutorises, true)) {
    $objet = 'Autre demande';
}
if ($isLocation) {
    $objet = 'Location Renault Trafic 9 places';
}

/* Validation */
$erreurs = [];
if (mb_strlen($nom, 'UTF-8') < 2)                         $erreurs[] = 'nom';
if (strlen(preg_replace('/\D/', '', $telephone)) < 10)   $erreurs[] = 'téléphone';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))          $erreurs[] = 'e-mail';
if (!$isLocation && mb_strlen($message, 'UTF-8') < 5)   $erreurs[] = 'message';
if ($isLocation) {
    $d1 = DateTime::createFromFormat('!Y-m-d', $dateDepart);
    $d2 = DateTime::createFromFormat('!Y-m-d', $dateRetour);
    $today = new DateTime('today');
    if (!$d1 || $d1->format('Y-m-d') !== $dateDepart || $d1 < $today) $erreurs[] = 'date de départ';
    if (!$d2 || $d2->format('Y-m-d') !== $dateRetour || ($d1 && $d2 < $d1)) $erreurs[] = 'date de retour';
}
if (preg_match('/(https?:\/\/.*){3,}/i', $message))      $erreurs[] = 'message (trop de liens)';

if ($erreurs) {
    reply(false, 'Merci de vérifier : ' . implode(', ', $erreurs) . '.', $wantsJson);
}

/* Construction de l'e-mail */
$sujetTexte = $isLocation
    ? 'Demande de disponibilité Trafic 9 places — ' . $nom
    : 'Demande site web — ' . $objet . ' — ' . $nom;
$sujet = '=?UTF-8?B?' . base64_encode($sujetTexte) . '?=';

$corps  = "Nouvelle demande reçue depuis le site internet JRM Autos\n";
$corps .= str_repeat('-', 56) . "\n\n";
$corps .= "Nom            : $nom\n";
$corps .= "Téléphone      : $telephone\n";
$corps .= "E-mail         : $email\n";
$corps .= "Objet          : $objet\n";
if ($isLocation) {
    $corps .= "Départ souhaité: " . $d1->format('d/m/Y') . "\n";
    $corps .= "Retour souhaité: " . $d2->format('d/m/Y') . "\n\n";
    $corps .= "Message :\n" . ($message !== '' ? $message : '(aucun message)') . "\n\n";
    $corps .= "À FAIRE : vérifier la disponibilité du Trafic et recontacter le client.\n";
    $corps .= "Aucune réservation n'a été confirmée automatiquement.\n\n";
} else {
    $corps .= "Véhicule       : " . ($vehicule !== '' ? $vehicule : 'non précisé') . "\n\n";
    $corps .= "Message :\n$message\n\n";
}
$corps .= str_repeat('-', 56) . "\n";
$corps .= 'Envoyé le ' . date('d/m/Y à H:i') . " — répondez directement à cet e-mail pour écrire au client.\n";

$entetes   = [];
$entetes[] = 'MIME-Version: 1.0';
$entetes[] = 'Content-Type: text/plain; charset=UTF-8';
$entetes[] = 'Content-Transfer-Encoding: 8bit';
$entetes[] = 'From: =?UTF-8?B?' . base64_encode(NOM_SITE) . '?= <' . EXPEDITEUR . '>';
$entetes[] = 'Reply-To: ' . $email;
$entetes[] = 'X-Mailer: PHP/' . phpversion();

$envoye = @mail(DESTINATAIRE, $sujet, $corps, implode("\r\n", $entetes), '-f' . EXPEDITEUR);

if ($envoye) {
    reply(true, 'Votre demande a bien été envoyée.', $wantsJson);
}
reply(false, "L'envoi n'a pas abouti. Merci de nous appeler au 05 56 63 03 84.", $wantsJson);
