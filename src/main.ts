/** Bootstrap: load the save, apply settings, mount navigation and route to Home. */

import './style.css';
import { app } from './app/app';
import { Router } from './ui/router';
import { mountNav } from './ui/components/nav';
import { homeScreen } from './ui/screens/home';
import { playScreen } from './ui/screens/play';
import { gameScreen } from './ui/screens/game';
import { leagueScreen } from './ui/screens/league';
import { profileScreen } from './ui/screens/profile';
import { petsScreen } from './ui/screens/pets';
import { shopScreen } from './ui/screens/shop';
import { sanctuaryScreen } from './ui/screens/sanctuary';
import { galleryScreen } from './ui/screens/gallery';
import { worldScreen } from './ui/screens/world';
import { regionScreen } from './ui/screens/region';
import { needsWelcome, welcomeScreen } from './ui/screens/welcome';
import { track } from './services/analytics';
import { catchUpAchievements } from './app/events';
import { startLeaderboardSync } from './app/leaderboardSync';

const root = document.getElementById('app')!;
const router = new Router(root);
app.router = router;
router.register({
  home: homeScreen,
  play: playScreen,
  game: gameScreen,
  pets: petsScreen,
  league: leagueScreen,
  shop: shopScreen,
  sanctuary: sanctuaryScreen,
  gallery: galleryScreen,
  world: worldScreen,
  region: regionScreen,
  welcome: welcomeScreen,
  profile: profileScreen,
});
app.applySettings();
mountNav(router);
router.onChange((r) => track('screen_view', { screen: r.screen }));

app.save.onboarding.sessions++;
void app.reconcilePurchases();
startLeaderboardSync();
catchUpAchievements();
app.persist();
track('app_open', { sessions: app.save.onboarding.sessions });

// Pause and save the board when the app is backgrounded; resume only if nothing is covering it.
document.addEventListener('visibilitychange', () => {
  const a = app.active;
  if (!a || router.route?.screen !== 'game') return;
  if (document.hidden) {
    a.session.pause();
    app.saveActive();
  } else if (!document.querySelector('.overlay')) {
    a.session.resume();
  }
});
window.addEventListener('pagehide', () => app.saveActive());

// Dev-only QA hook for the screenshot harness. Dead-code-eliminated from release builds.
if (import.meta.env.DEV) {
  void import('./app/gameFlow').then(({ startGame }) => {
    (window as unknown as { __pt: unknown }).__pt = { app, go: (r: Parameters<Router['go']>[0]) => router.go(r), start: startGame };
  });
}

router.go({ screen: needsWelcome() ? 'welcome' : 'home' });
