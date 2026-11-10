// Public legal and support pages: /privacy, /terms, /support, /copyright, /acknowledgements.
// Baseline text for attorney review. Keep it in step with what the app and server really do.
const UPDATED = 'November 10, 2026';
const EMAIL = 'support@nuvigo.app';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sec = (title, ...paras) => `<h2>${esc(title)}</h2>` + paras.map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`)).join('');
const list = (items) => '<ul>' + items.map((i) => `<li>${i}</li>`).join('') + '</ul>';

const PAGES = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      '<p>NuviGo is a media organizer and player. This policy explains what information NuviGo handles and why. NuviGo has no ads and no third-party trackers, and we do not sell your information.</p>',
      sec('What stays on your device',
        'Your watch history, progress, downloads, settings and the add-ons you install are stored on your device. If you never create a NuviGo account, none of this is sent to us.'),
      sec('If you create a NuviGo account',
        'An account is optional. If you create one we store:',
        list([
          'Your email address and a password hash. We never store your password itself.',
          'Data you choose to sync: your add-on list, watch progress, watched items, settings, and the connection details for services you link (such as debrid or tracking services). Linked-service details are encrypted on our server.',
        ]),
        'We use this only to run your account and sync it between your devices. Your sign-in session lasts up to 90 days unless you sign out.'),
      sec('Error reports',
        'The app can send short, anonymous error reports to help us fix bugs. A report contains a short message about what failed, the app version, iOS version and device model. It does not contain your account, email, watch history or viewing links, and we do not store your IP address with it. You can turn error reports off in the Account tab. We may use rate limiting based on IP address, which is held only in memory.'),
      sec('Services the app talks to',
        'To work, the app contacts third-party services. These receive the information needed for the request, which can include your IP address and what you look up:',
        list([
          'The Movie Database (TMDB) and OMDb, for titles, artwork and ratings (through our server and directly from the app).',
          'The add-ons you install, which are run by independent third parties. They see the requests you make through them. We do not control them. Please read their policies.',
          'Services you choose to link, such as Trakt, Simkl, MyAnimeList, AniList, Plex, OpenSubtitles and debrid services. Each has its own terms and privacy policy.',
          'Our hosting provider (Railway), which processes our server data on our behalf.',
          'Apple, which handles App Store purchases, including optional tips, and iCloud sync. We do not receive your payment details.',
        ])),
      sec('How long we keep things',
        'Account data is kept until you delete your account. Error reports are kept only as long as we need them to fix bugs. You can delete your account at any time in the Account tab (Delete account). That removes your email, password hash and all synced data from our server.'),
      sec('Your choices and rights',
        `You can use NuviGo without an account, turn off error reports, clear your data, and delete your account in the app. Depending on where you live, you may also have the right to ask what we hold about you, to correct or delete it, or to object to certain uses. Email us at <a href="mailto:${EMAIL}">${EMAIL}</a> and we will respond.`),
      sec('Children',
        'NuviGo is not directed to children under 13 and we do not knowingly collect information from them. If you believe a child has created an account, contact us and we will delete it.'),
      sec('Security',
        'We use industry-standard measures such as hashed passwords and encryption of linked-service details, but no system is perfectly secure.'),
      sec('Changes',
        'We may update this policy. The date at the top shows the latest version. Continuing to use NuviGo after a change means you accept it.'),
      sec('Contact', `<a href="mailto:${EMAIL}">${EMAIL}</a>`),
    ].join(''),
  },

  terms: {
    title: 'Terms of Use',
    body: [
      '<p>By using NuviGo you agree to these terms. If you do not agree, please do not use the app.</p>',
      sec('What NuviGo is',
        'NuviGo is a media organizer and player. It was built as an additional way for you to store, organize and watch media that you legally own or have the legal right to access. NuviGo does not provide, host, sell, license or distribute any movies, shows, music or other video content, and it does not provide any add-ons.'),
      sec('Add-ons and third-party content',
        'Add-ons are created and run by independent third parties. NuviGo is not affiliated with, and does not review, endorse, verify or control, any add-on or the content it points to. You decide what to install and you are solely responsible for it.'),
      sec('Acceptable use',
        'You agree to use NuviGo only with content you own, content you are licensed to use, or content that is in the public domain or freely and lawfully available. You will not use NuviGo to infringe copyright or other rights, to bypass paywalls, digital rights management or regional restrictions, or to break any law. We may suspend or permanently remove access to NuviGo and any NuviGo account, without prior notice, if we become aware of or reasonably suspect misuse.'),
      sec('Your account',
        'You are responsible for keeping your password safe and for activity under your account. You can delete your account at any time in the Account tab.'),
      sec('Tips',
        'Tips are voluntary one-time payments that help with running costs. They are processed by Apple, give you no goods, services or extra features, and are not charitable donations. Refund requests are subject to Apple\'s policies.'),
      sec('Apple',
        'These terms are between you and NuviGo, not Apple. Apple is not responsible for the app or its content, has no obligation to provide support or maintenance, and is a third-party beneficiary of these terms with the right to enforce them against you. Apple\'s Licensed Application End User License Agreement also applies to your use of the app.'),
      sec('No warranty',
        'NuviGo is provided "as is" and "as available". We make no promises about any add-on, or about the availability, accuracy, quality or legality of any content, or that the app will be uninterrupted or error free.'),
      sec('Limit of liability',
        'To the fullest extent the law allows, NuviGo and its owner are not liable for any indirect, incidental or consequential loss, or for any loss, claim or legal consequence that results from your use of add-ons or content or from your breach of these terms or the law.'),
      sec('Changes',
        'We may update these terms. Continuing to use NuviGo after a change means you accept the updated terms.'),
      sec('Contact', `<a href="mailto:${EMAIL}">${EMAIL}</a>`),
    ].join(''),
  },

  support: {
    title: 'Support',
    body: [
      `<p>Questions, bug reports and feedback: <a href="mailto:${EMAIL}">${EMAIL}</a>. In the app you can also use Account, then Report a bug, which fills in your app and device details for you.</p>`,
      sec('Common questions',
        '<p><b>Where do I find movies?</b> NuviGo does not include any content or add-ons. You add add-ons you already have the right to use from the Add-Ons tab.</p>',
        '<p><b>How do I delete my account?</b> Account tab, then Delete account.</p>',
        '<p><b>How do I turn off error reports?</b> Account tab, then the anonymous error reports switch.</p>',
        '<p><b>Tips and refunds.</b> Tips are handled by Apple. Request refunds at reportaproblem.apple.com.</p>'),
      sec('Legal', '<p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a> · <a href="/copyright">Copyright</a> · <a href="/acknowledgements">Acknowledgements</a></p>'),
    ].join(''),
  },

  copyright: {
    title: 'Copyright and Takedown',
    body: [
      '<p>NuviGo does not host, store or distribute movies, shows or other media, and does not provide add-ons. We respect the rights of copyright owners.</p>',
      sec('Reporting misuse',
        `If you are a rights holder and believe NuviGo is being used to infringe your work, email <a href="mailto:${EMAIL}">${EMAIL}</a> with: your name and contact details, a description of the work, where you believe the infringement is occurring (for example an add-on address), and a statement that you are authorized to act for the rights holder. We review valid notices, will cooperate with courts and law enforcement where legally required, and may remove access for users who misuse the app.`),
      sec('Our policy',
        'We do not condone or support piracy. Accounts that we find or reasonably suspect are used for unauthorized access to copyrighted material may be permanently banned.'),
    ].join(''),
  },

  acknowledgements: {
    title: 'Acknowledgements',
    body: [
      '<p>NuviGo uses data and services from the following providers. All trademarks and logos belong to their owners.</p>',
      sec('The Movie Database (TMDB)',
        'This product uses the TMDB API but is not endorsed or certified by TMDB. Title information and artwork are provided by TMDB.'),
      sec('OMDb', 'Ratings data is provided by the OMDb API.'),
      sec('Other services',
        'Trakt, Simkl, MyAnimeList, AniList, Plex and OpenSubtitles are used only when you choose to connect them. NuviGo is not affiliated with or endorsed by any of them.'),
    ].join(''),
  },
};

const css = 'body{font:16px/1.55 -apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 18px 60px;color:#1c1b1f;background:#fff}@media(prefers-color-scheme:dark){body{background:#121212;color:#eee}a{color:#a99cff}}h1{font-size:28px;margin:0 0 4px}h2{font-size:19px;margin:28px 0 6px}.d{color:#777;font-size:14px;margin:0 0 18px}ul{padding-left:22px}li{margin:6px 0}a{color:#5b43d6}';

function render(slug) {
  const p = PAGES[slug];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} · NuviGo</title><style>${css}</style></head><body><h1>${esc(p.title)}</h1><p class="d">NuviGo · Last updated ${UPDATED}</p>${p.body}</body></html>`;
}

function handle(req, res, pathname) {
  const slug = pathname.replace(/^\/|\/$/g, '').toLowerCase();
  const alias = { acknowledgments: 'acknowledgements', dmca: 'copyright' };
  const key = alias[slug] || slug;
  if (!PAGES[key] || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
  res.end(req.method === 'HEAD' ? undefined : render(key));
  return true;
}

module.exports = { handle, render, PAGES };
