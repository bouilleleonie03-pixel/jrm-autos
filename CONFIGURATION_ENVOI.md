# Configuration de l'envoi des formulaires

Le compte Google personnel utilisé pour Apps Script sert uniquement à l'expédition technique. Le script emploie `MailApp`, qui envoie des messages sans lire la boîte du compte. Le destinataire est fixé dans le script à `jrm.autos33@gmail.com`; aucun CC ni CCI n'est défini. Le champ `Reply-To` est l'adresse fournie par le client.

Le site ne possède pas de domaine personnalisé. Resend ne permet pas d'envoyer à une adresse externe avec son expéditeur de test et demande un domaine vérifié en production ([erreurs Resend](https://resend.com/docs/api-reference/errors), [domaines vérifiés](https://resend.com/docs/dashboard/domains/introduction)). Une adresse Gmail seule sur SendGrid est réservée aux tests et n'est pas recommandée pour la production ([Sender Identity](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sender-identity)). Apps Script envoie avec l'identité Gmail du compte expéditeur réel et accepte un destinataire externe ; le quota grand public documenté est de 100 destinataires par jour ([MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [quotas](https://developers.google.com/apps-script/guides/services/quotas)).

## Mise en place

1. Ouvrir Apps Script avec le Gmail personnel qui servira uniquement d'expéditeur.
2. Copier `apps-script/Code.gs` dans le fichier `Code.gs` du projet, puis activer l'affichage du manifeste et copier `apps-script/appsscript.json` dans `appsscript.json`.
3. Exécuter `authorizeMailSending` depuis l'éditeur et accorder uniquement l'autorisation `script.send_mail`. Le script ne demande pas la lecture de Gmail. Google peut afficher son avertissement standard pour un script personnel non publié.
4. Déployer comme **Web app**, avec **Execute as: Me** et accès **Anyone, including anonymous**, puis copier l'URL `/exec`.
5. Dans les variables d'environnement du projet Vercel, ajouter `GOOGLE_APPS_SCRIPT_URL` en type **Secret**, avec l'URL `/exec`, pour l'environnement **Production**. Cette URL agit comme secret d'accès : ne pas la placer dans le HTML/JavaScript public ni dans le dépôt.
6. Redéployer Vercel.

Le script fixe `to` sur la boîte du garage, limite les envois à 10 par minute et refuse les messages mal formés. Il ne prend jamais le destinataire depuis le navigateur. Pour vérifier les réglages Vercel sans afficher la valeur secrète, visiter `/api/contact?etat` ; `GOOGLE_APPS_SCRIPT_URL` doit être `true`.
