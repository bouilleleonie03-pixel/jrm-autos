/**
 * JRM AUTOS — Traitement des formulaires du site (contact et demande de location)
 *
 * Fonction Vercel : elle reçoit le formulaire, le vérifie, puis l'envoie par e-mail
 * au garage en passant par son compte Gmail.
 *
 * ┌──────────────────────── CONFIGURATION ────────────────────────┐
 * │ À saisir dans Vercel > projet > Settings > Environment        │
 * │ Variables (jamais dans ce fichier) :                          │
 * │                                                               │
 * │ GMAIL_USER          adresse Gmail du garage                   │
 * │ GMAIL_APP_PASSWORD  mot de passe d'application Google         │
 * │ CONTACT_TO          (facultatif) autre adresse de réception   │
 * └───────────────────────────────────────────────────────────────┘
 */
import nodemailer from 'nodemailer';

const NOM_SITE = 'Site JRM Autos';
const TELEPHONE_GARAGE = '05 56 63 03 84';

const OBJETS_AUTORISES = [
  'Mécanique et entretien', 'Diagnostic automobile', 'Carrosserie', 'Vitrage automobile',
  'Carte grise', 'Gardiennage', 'Prêt de véhicule', 'Location Renault Trafic', 'Véhicule BMW', 'Autre demande',
];

const EMAIL_VALIDE = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/;

/* ------------------------------------------------------------------ */
/* Outils                                                             */

/** Valeur d'un champ : texte nettoyé, limité à `max` caractères. */
function champ(form, cle, max = 200) {
  const brut = form.get(cle);
  const texte = (typeof brut === 'string' ? brut : '').trim().replace(/[\r\0]/g, '');
  return Array.from(texte).slice(0, max).join('');
}

const surUneLigne = (v) => v.replace(/[\n\t]+/g, ' ');

/** Date et heure à Paris, découpées (jour, mois, année, heure, minute). */
function partiesParis(instant) {
  const format = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = {};
  for (const { type, value } of format.formatToParts(instant)) p[type] = value;
  return p;
}

/** Vérifie qu'une date AAAA-MM-JJ existe réellement. */
function dateValide(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const dateFr = (v) => v.split('-').reverse().join('/');

/* ------------------------------------------------------------------ */
/* Vérification du formulaire et préparation de l'e-mail              */

/**
 * Renvoie l'un de ces résultats :
 *   { ok: true, mail }        formulaire valide, e-mail prêt à partir
 *   { ok: true, ignore: true } robot détecté : on répond « merci » sans rien envoyer
 *   { ok: false, message }    formulaire à corriger
 */
export function preparer(form, maintenant = new Date()) {
  /* Anti-spam 1 : champ piège invisible (doit rester vide) */
  if (champ(form, 'site_web') !== '') return { ok: true, ignore: true };

  /* Anti-spam 2 : délai minimum de remplissage (3 s).
     Un écart négatif signifie que l'horloge du visiteur avance : on ne le pénalise pas. */
  const ts = parseInt(champ(form, '_ts', 20), 10) || 0;
  const ecart = Math.floor(maintenant.getTime() / 1000) - ts;
  if (ts > 0 && ecart >= 0 && ecart < 3) {
    return { ok: false, message: 'Envoi trop rapide, merci de réessayer.' };
  }

  /* Nettoyage */
  const nom = surUneLigne(champ(form, 'nom', 100));
  const telephone = surUneLigne(champ(form, 'telephone', 30));
  const email = surUneLigne(champ(form, 'email', 150));
  let objet = surUneLigne(champ(form, 'objet', 80));
  const vehicule = surUneLigne(champ(form, 'vehicule', 120));
  const message = champ(form, 'message', 4000);
  const estLocation = form.get('formulaire') === 'location';
  const dateDepart = surUneLigne(champ(form, 'date_depart', 10));
  const dateRetour = surUneLigne(champ(form, 'date_retour', 10));

  if (!OBJETS_AUTORISES.includes(objet)) objet = 'Autre demande';
  if (estLocation) objet = 'Location Renault Trafic 9 places';

  /* Validation */
  const erreurs = [];
  if (Array.from(nom).length < 2) erreurs.push('nom');
  if (telephone.replace(/\D/g, '').length < 10) erreurs.push('téléphone');
  if (!EMAIL_VALIDE.test(email)) erreurs.push('e-mail');
  if (!estLocation && Array.from(message).length < 5) erreurs.push('message');
  if (estLocation) {
    const p = partiesParis(maintenant);
    const aujourdhui = `${p.year}-${p.month}-${p.day}`;
    const departValide = dateValide(dateDepart);
    if (!departValide || dateDepart < aujourdhui) erreurs.push('date de départ');
    if (!dateValide(dateRetour) || (departValide && dateRetour < dateDepart)) erreurs.push('date de retour');
  }
  if ((message.match(/https?:\/\//gi) || []).length >= 3) erreurs.push('message (trop de liens)');

  if (erreurs.length) {
    return { ok: false, message: `Merci de vérifier : ${erreurs.join(', ')}.` };
  }

  /* Construction de l'e-mail */
  const sujet = estLocation
    ? `Demande de disponibilité Trafic 9 places — ${nom}`
    : `Demande site web — ${objet} — ${nom}`;

  const trait = '-'.repeat(56);
  let corps = 'Nouvelle demande reçue depuis le site internet JRM Autos\n';
  corps += `${trait}\n\n`;
  corps += `Nom            : ${nom}\n`;
  corps += `Téléphone      : ${telephone}\n`;
  corps += `E-mail         : ${email}\n`;
  corps += `Objet          : ${objet}\n`;
  if (estLocation) {
    corps += `Départ souhaité: ${dateFr(dateDepart)}\n`;
    corps += `Retour souhaité: ${dateFr(dateRetour)}\n\n`;
    corps += `Message :\n${message !== '' ? message : '(aucun message)'}\n\n`;
    corps += 'À FAIRE : vérifier la disponibilité du Trafic et recontacter le client.\n';
    corps += "Aucune réservation n'a été confirmée automatiquement.\n\n";
  } else {
    corps += `Véhicule       : ${vehicule !== '' ? vehicule : 'non précisé'}\n\n`;
    corps += `Message :\n${message}\n\n`;
  }
  const p = partiesParis(maintenant);
  corps += `${trait}\n`;
  corps += `Envoyé le ${p.day}/${p.month}/${p.year} à ${p.hour}:${p.minute} — répondez directement à cet e-mail pour écrire au client.\n`;

  return { ok: true, mail: { sujet, corps, repondreA: email } };
}

/* ------------------------------------------------------------------ */
/* Envoi par le compte Gmail du garage                                */

async function envoyer(mail) {
  const utilisateur = (process.env.GMAIL_USER || '').trim();
  // Google affiche le mot de passe d'application par blocs de 4 : on retire les espaces.
  const motDePasse = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!utilisateur || !motDePasse) {
    const erreur = new Error('réglages GMAIL_USER ou GMAIL_APP_PASSWORD absents dans Vercel');
    erreur.code = 'REGLAGES';
    throw erreur;
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: utilisateur, pass: motDePasse },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  await transport.sendMail({
    from: { name: NOM_SITE, address: utilisateur },
    to: (process.env.CONTACT_TO || '').trim() || utilisateur,
    replyTo: mail.repondreA,
    subject: mail.sujet,
    text: mail.corps,
  });
}

/* ------------------------------------------------------------------ */
/* Réponses                                                           */

/**
 * Avec JavaScript, le site attend une réponse JSON { ok, message }.
 * Sans JavaScript, le navigateur est redirigé vers la page de remerciement ou d'erreur.
 */
const RETOUR_ERREUR_CONTACT = '/contact.html?erreur=1#formulaire';
const RETOUR_ERREUR_LOCATION = '/location.html?erreur=1#contact-form';

function repondre(ok, message, enJson, retourErreur = RETOUR_ERREUR_CONTACT, statut = ok ? 200 : 400, raison) {
  const entetes = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (enJson) {
    // `raison` aide au diagnostic : « reglages » (variables Vercel absentes) ou « envoi » (Gmail a refusé).
    return new Response(JSON.stringify(raison ? { ok, message, raison } : { ok, message }), {
      status: statut,
      headers: { ...entetes, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  return new Response(null, {
    status: 303,
    headers: { ...entetes, Location: ok ? '/merci.html' : retourErreur },
  });
}

export async function POST(request) {
  const enJson = (request.headers.get('accept') || '').includes('application/json');

  let form;
  try {
    form = await request.formData();
  } catch {
    return repondre(false, 'Le formulaire est illisible, merci de réessayer.', enJson);
  }

  const retourErreur = form.get('formulaire') === 'location' ? RETOUR_ERREUR_LOCATION : RETOUR_ERREUR_CONTACT;
  const resultat = preparer(form);
  if (!resultat.ok) return repondre(false, resultat.message, enJson, retourErreur);
  if (resultat.ignore) return repondre(true, 'Merci.', enJson); // on ne signale rien au robot

  try {
    await envoyer(resultat.mail);
  } catch (erreur) {
    // Visible dans Vercel > projet > Logs. Aucune donnée du visiteur n'y est écrite.
    console.error('[contact] envoi impossible :', erreur && erreur.message ? erreur.message : erreur);
    if (erreur && erreur.code === 'REGLAGES') {
      return repondre(false, `Le formulaire n'est pas encore activé. Merci de nous appeler au ${TELEPHONE_GARAGE}.`, enJson, retourErreur, 503, 'reglages');
    }
    return repondre(false, `L'envoi n'a pas abouti. Merci de nous appeler au ${TELEPHONE_GARAGE}.`, enJson, retourErreur, 502, 'envoi');
  }

  return repondre(true, 'Votre demande a bien été envoyée.', enJson);
}

/** Une visite directe de cette adresse renvoie vers la page de contact. */
export function GET(request) {
  // /api/contact?etat indique seulement si les réglages Vercel sont présents, jamais leur valeur.
  const adresse = request && request.url ? String(request.url) : '';
  if (/[?&]etat(=|&|$)/.test(adresse)) {
    const etat = {
      fonction: 'en ligne',
      reglages: {
        GMAIL_USER: Boolean((process.env.GMAIL_USER || '').trim()),
        GMAIL_APP_PASSWORD: Boolean((process.env.GMAIL_APP_PASSWORD || '').trim()),
      },
    };
    return new Response(JSON.stringify(etat), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(null, { status: 303, headers: { Location: '/contact.html' } });
}
