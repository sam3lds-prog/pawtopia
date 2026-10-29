/**
 * League → Leaderboard: Paw Points from the Journey and the Daily, compared with other players. Opt-in with a
 * nickname and a picture of one of your animals; every board solved after joining is checked by the server (it replays
 * the moves), so the table is fair. Weekly (UTC week) and all-time tables, your own rank even outside the top 50, a way
 * to report an unkind name, and leaving deletes everything. Only real players are ever shown.
 */

import { app } from '../../app/app';
import { resetLeaderboardLocal, syncLeaderboard } from '../../app/leaderboardSync';
import { COMPANIONS, isCompanionId } from '../../meta/catalogs/companions';
import { PETS, isPetId } from '../../meta/catalogs/pets';
import { cleanNickname, nickProblemText, NICK_MAX, suggestNickname } from '../../leaderboard/nickname';
import { leaderboard, LbClientError, type LbBoard, type LbEntry, type LbTable } from '../../services/leaderboard';
import { track } from '../../services/analytics';
import { formatDuration, utcWeekBounds } from '../../game/dates';
import { portrait } from '../components/petSheet';
import { openSheet, toast } from '../components/sheet';
import { esc, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { friendPortrait } from './sanctuary';

let lastBoard: LbBoard = 'week';

export function avatarPortrait(id: string): string {
  if (isPetId(id)) return portrait(id, 'happy');
  if (isCompanionId(id)) return friendPortrait(id);
  return portrait('mochi', 'happy');
}

/** Animals the player has welcomed (a picture can only be someone you know). */
function avatarChoices(): string[] {
  const s = app.save;
  const mine = [...PETS.filter((p) => s.inventory.pets[p.id]).map((p) => p.id as string), ...COMPANIONS.filter((c) => s.inventory.companions[c.id]).map((c) => c.id as string)];
  return mine.length ? mine : ['mochi', 'biscuit'];
}

function errorText(e: unknown): string {
  if (e instanceof LbClientError) {
    if (e.kind === 'offline') return "Couldn't reach the leaderboard. Check your connection and try again.";
    if (e.kind === 'invalid' && e.detail && ['length', 'characters', 'words'].includes(e.detail)) return nickProblemText(e.detail as 'length');
    if (e.kind === 'invalid' && e.detail?.includes(' ')) return e.detail;
    if (e.kind === 'unavailable') return 'The leaderboard is not open yet.';
  }
  return 'Something went wrong. Please try again in a moment.';
}

export function mountLeaderboard(parent: Scope, host: HTMLElement): void {
  const scope = parent.child();
  let table: LbTable | null = null;
  let loading = false;
  let failed: string | null = null;
  let busy = false;

  const lb = () => app.save.leaderboard;

  function offCard(): string {
    return `<section class="card empty-card">
      <span class="empty-card__icon">${ICON.trophy}</span>
      <h3>The leaderboard is coming</h3>
      <p class="muted">Soon you'll be able to compare Paw Points from the Journey and the Daily with players everywhere. It will be opt-in: a nickname, no email, nothing else.</p>
    </section>`;
  }

  function deviceNote(): string {
    return leaderboard.mode === 'device' ? `<p class="notice">${ICON.info}<span>Test build: this leaderboard lives on this device and only ever shows you. The real one needs the Firebase settings.</span></p>` : '';
  }

  function joinCard(name = suggestNickname(), avatar = lb().avatar || avatarChoices()[0], error = ''): string {
    const choices = avatarChoices();
    const pick = choices.includes(avatar) ? avatar : choices[0];
    return `${deviceNote()}
    <section class="card lb-join" aria-labelledby="lbj-h">
      <span class="lb-join__icon">${ICON.trophy}</span>
      <h3 id="lbj-h">Join the leaderboard</h3>
      <p class="muted">Compare your Paw Points from the Journey and the Daily with players everywhere, this week and all time. Each board you solve after joining is checked by our server, so the table is fair.</p>
      <label class="lb-field">
        <span>Your name on the board</span>
        <span class="lb-field__row">
          <input name="nickname" value="${esc(name)}" maxlength="${NICK_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-describedby="lbj-err"/>
          <button class="btn btn--small btn--secondary" data-act="suggest" type="button" aria-label="Suggest another name">${ICON.sparkle}</button>
        </span>
      </label>
      <p class="lb-field__error" id="lbj-err" role="alert">${esc(error)}</p>
      <fieldset class="lb-avatars">
        <legend>Your picture</legend>
        ${choices
          .map(
            (id) => `<label class="lb-avatar"><input type="radio" name="avatar" value="${id}" ${id === pick ? 'checked' : ''}/><span class="lb-avatar__pic">${avatarPortrait(id)}</span><span class="sr-only">${esc(isPetId(id) ? PETS.find((p) => p.id === id)!.name : COMPANIONS.find((c) => c.id === id)!.name)}</span></label>`,
          )
          .join('')}
      </fieldset>
      <p class="muted lb-privacy">${ICON.shield}We keep a random player id, this name, this picture and your leaderboard points. No email, no contacts, no tracking. Leave any time and all of it is deleted.</p>
      <button class="btn btn--block" data-act="join" ${busy ? 'disabled' : ''}>${busy ? 'Joining…' : 'Join'}</button>
    </section>`;
  }

  function row(e: LbEntry): string {
    return `<li><button class="lb-row ${e.you ? 'is-you' : ''}" data-uid="${esc(e.uid)}" ${e.you ? 'disabled' : ''} aria-label="${esc(`${e.rank}. ${e.nickname}${e.you ? ' (you)' : ''}, ${e.points} points`)}">
      <span class="lb-rank num ${e.rank <= 3 ? `is-top is-${e.rank}` : ''}">${e.rank}</span>
      <span class="lb-pic">${avatarPortrait(e.avatar)}</span>
      <span class="lb-name">${esc(e.nickname)}${e.you ? ' <small>you</small>' : ''}</span>
      <span class="lb-pts num">${e.points.toLocaleString()}</span>
    </button></li>`;
  }

  function joinedView(): string {
    const l = lb();
    const ends = formatDuration(utcWeekBounds().end.getTime() - Date.now());
    const head = `${deviceNote()}
      <div class="segmented" role="tablist" aria-label="Which table">
        <button role="tab" data-board="week" aria-selected="${lastBoard === 'week'}">This week</button>
        <button role="tab" data-board="all" aria-selected="${lastBoard === 'all'}">All time</button>
      </div>
      <p class="muted lb-sub">${lastBoard === 'week' ? `Paw Points earned this week. New week in ${ends}.` : 'Every Paw Point earned since you joined.'}</p>`;
    let body: string;
    if (failed) body = `<section class="card lb-state"><p>${esc(failed)}</p><button class="btn btn--secondary" data-act="retry">Try again</button></section>`;
    else if (!table) body = `<section class="card lb-state" aria-busy="true"><p class="muted">Loading the leaderboard…</p></section>`;
    else {
      const you = table.entries.find((e) => e.you) ?? table.you;
      const list = table.entries.filter((e) => e.points > 0);
      body = `
        <section class="card lb-me" aria-label="You">
          <span class="lb-me__pic">${avatarPortrait(l.avatar)}</span>
          <span class="lb-me__body"><b>${esc(l.nickname)}</b><span class="muted">${you && you.points > 0 ? `#${you.rank} of ${plural(table.players, 'player')}` : lastBoard === 'week' ? 'Solve a level or the Daily to get on this week’s table' : 'Solve a level or the Daily to get on the table'}</span></span>
          <span class="lb-me__pts"><b class="num">${(you?.points ?? 0).toLocaleString()}</b><small>points</small></span>
        </section>
        ${
          list.length
            ? `<ol class="lb-list" aria-label="${lastBoard === 'week' ? 'This week' : 'All time'}">${list.map(row).join('')}${table.you && table.you.points > 0 ? `<li class="lb-gap" aria-hidden="true">···</li>${row(table.you)}` : ''}</ol>`
            : `<p class="empty">Nobody has scored ${lastBoard === 'week' ? 'this week' : ''} yet. Be the first!</p>`
        }`;
    }
    const pending = l.pending.length
      ? `<p class="lb-pending">${ICON.clock}<span>${plural(l.pending.length, 'solved board')} waiting to be sent.</span><button class="btn btn--quiet btn--small" data-act="send">Send now</button></p>`
      : '';
    return `${head}${body}${pending}
      <div class="lb-actions">
        <button class="btn btn--quiet" data-act="edit">${ICON.paw}Edit name or picture</button>
        <button class="btn btn--quiet" data-act="leave">Leave the leaderboard</button>
      </div>`;
  }

  function render(): void {
    if (leaderboard.mode === 'off') host.innerHTML = offCard();
    else if (!lb().joined) host.innerHTML = joinCard(lb().nickname || undefined);
    else host.innerHTML = joinedView();
  }

  async function load(): Promise<void> {
    if (!lb().joined || loading) return;
    loading = true;
    failed = null;
    render();
    try {
      await syncLeaderboard();
      if (!scope.alive) return;
      table = await leaderboard.table(lastBoard);
    } catch (e) {
      if (!scope.alive) return;
      if (e instanceof LbClientError && e.kind === 'not-joined') {
        app.save.leaderboard.joined = false;
        app.persist();
      } else failed = errorText(e);
    } finally {
      loading = false;
    }
    if (scope.alive) render();
  }

  async function join(nickname: string, avatar: string, editing: boolean): Promise<string | null> {
    const ok = cleanNickname(nickname);
    if (!ok.ok) return nickProblemText(ok.problem);
    try {
      const r = await leaderboard.join({ nickname: ok.name, avatar });
      const l = app.save.leaderboard;
      const first = !l.joined;
      l.joined = true;
      l.nickname = ok.name;
      l.avatar = avatar;
      l.joinedAt ??= new Date().toISOString();
      l.last = { total: r.total, week: r.week, weekKey: r.weekKey, at: new Date().toISOString() };
      app.persist();
      track('league_open', { leaderboard: editing ? 'edit' : first ? 'join' : 'rejoin' });
      return null;
    } catch (e) {
      return errorText(e);
    }
  }

  render();
  void load();

  scope.on(host, 'click', async (ev) => {
    const t = ev.target as HTMLElement;
    const b = t.closest('[data-board]') as HTMLElement | null;
    if (b) {
      lastBoard = b.dataset.board as LbBoard;
      table = null;
      void load();
      return;
    }
    const other = t.closest('[data-uid]') as HTMLButtonElement | null;
    if (other && !other.disabled) {
      const entry = [...(table?.entries ?? []), ...(table?.you ? [table.you] : [])].find((e) => e.uid === other.dataset.uid);
      if (entry) reportSheet(scope, entry);
      return;
    }
    const a = t.closest('[data-act]') as HTMLElement | null;
    if (!a) return;
    switch (a.dataset.act) {
      case 'suggest': {
        const input = host.querySelector('input[name="nickname"]') as HTMLInputElement | null;
        if (input) input.value = suggestNickname();
        break;
      }
      case 'join': {
        if (busy) return;
        const name = (host.querySelector('input[name="nickname"]') as HTMLInputElement).value;
        const avatar = (host.querySelector('input[name="avatar"]:checked') as HTMLInputElement | null)?.value ?? avatarChoices()[0];
        busy = true;
        render();
        (host.querySelector('input[name="nickname"]') as HTMLInputElement).value = name;
        const err = await join(name, avatar, false);
        busy = false;
        if (!scope.alive) return;
        if (err) {
          host.innerHTML = joinCard(name, avatar, err);
          (host.querySelector('input[name="nickname"]') as HTMLInputElement | null)?.focus();
        } else {
          toast(`Welcome to the leaderboard, ${app.save.leaderboard.nickname}!`, ICON.trophy);
          table = null;
          void load();
        }
        break;
      }
      case 'retry':
        void load();
        break;
      case 'send': {
        const r = await syncLeaderboard();
        if (!scope.alive) return;
        toast(r ? (r.points ? `+${r.points} points on the leaderboard` : 'Sent. Nothing new to add.') : "Couldn't send right now. It'll try again later.");
        table = null;
        void load();
        break;
      }
      case 'edit':
        editSheet(scope, join, () => {
          table = null;
          void load();
        });
        break;
      case 'leave':
        leaveSheet(scope, () => render());
        break;
    }
  });

  scope.on(host, 'submit', (e) => e.preventDefault());
  scope.on(host, 'keydown', (e) => {
    const k = e as KeyboardEvent;
    if (k.key === 'Enter' && (k.target as HTMLElement).matches('input[name="nickname"]')) {
      k.preventDefault();
      (host.querySelector('[data-act="join"]') as HTMLButtonElement | null)?.click();
    }
  });
}

function editSheet(scope: Scope, join: (n: string, a: string, editing: boolean) => Promise<string | null>, done: () => void): void {
  const l = app.save.leaderboard;
  const choices = avatarChoices();
  const sh = openSheet(scope, {
    title: 'Your name and picture',
    body: `
      <label class="lb-field"><span>Name</span><span class="lb-field__row"><input name="nickname" value="${esc(l.nickname)}" maxlength="${NICK_MAX}" autocomplete="off" spellcheck="false"/><button class="btn btn--small btn--secondary" data-act="suggest" type="button" aria-label="Suggest a name">${ICON.sparkle}</button></span></label>
      <p class="lb-field__error" role="alert"></p>
      <fieldset class="lb-avatars"><legend>Picture</legend>${choices
        .map((id) => `<label class="lb-avatar"><input type="radio" name="avatar" value="${id}" ${id === l.avatar ? 'checked' : ''}/><span class="lb-avatar__pic">${avatarPortrait(id)}</span></label>`)
        .join('')}</fieldset>
      <div class="sheet__actions"><button class="btn btn--block" data-act="save">Save</button><button class="btn btn--quiet" data-act="close">Cancel</button></div>`,
  });
  let saving = false;
  sh.scope.on(sh.el, 'click', async (e) => {
    const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a || saving) return;
    if (a.dataset.act === 'close') sh.close();
    else if (a.dataset.act === 'suggest') (sh.el.querySelector('input[name="nickname"]') as HTMLInputElement).value = suggestNickname();
    else if (a.dataset.act === 'save') {
      saving = true;
      const name = (sh.el.querySelector('input[name="nickname"]') as HTMLInputElement).value;
      const avatar = (sh.el.querySelector('input[name="avatar"]:checked') as HTMLInputElement | null)?.value ?? l.avatar;
      const err = await join(name, avatar, true);
      saving = false;
      if (!sh.scope.alive) return;
      if (err) (sh.el.querySelector('.lb-field__error') as HTMLElement).textContent = err;
      else {
        sh.close();
        toast('Saved.');
        done();
      }
    }
  });
}

function leaveSheet(scope: Scope, done: () => void): void {
  const sh = openSheet(scope, {
    title: 'Leave the leaderboard?',
    body: `<p class="sheet__lead">Your name, picture and leaderboard points are deleted from our server. Your puzzles, Paw Points and everything else in the app stay exactly as they are. You can join again later, starting from zero.</p>
      <p class="lb-field__error" role="alert"></p>
      <div class="sheet__actions"><button class="btn btn--block btn--danger" data-act="leave">Leave and delete</button><button class="btn btn--quiet" data-act="close">Stay</button></div>`,
  });
  let busy = false;
  sh.scope.on(sh.el, 'click', async (e) => {
    const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a || busy) return;
    if (a.dataset.act === 'close') return sh.close();
    busy = true;
    try {
      await leaderboard.leave();
      resetLeaderboardLocal(app.save);
      app.persist();
      if (!sh.scope.alive) return;
      sh.close();
      toast('You left the leaderboard. Everything about you there was deleted.');
      done();
    } catch (err) {
      busy = false;
      if (sh.scope.alive) (sh.el.querySelector('.lb-field__error') as HTMLElement).textContent = errorText(err);
    }
  });
}

function reportSheet(scope: Scope, e: LbEntry): void {
  const sh = openSheet(scope, {
    title: e.nickname,
    body: `<div class="lb-report__pic">${avatarPortrait(e.avatar)}</div>
      <p class="sheet__lead">#${e.rank} · ${e.points.toLocaleString()} points</p>
      <p class="muted">If this name is unkind or inappropriate, let us know. A name reported by several players is replaced with a neutral one.</p>
      <div class="sheet__actions"><button class="btn btn--secondary btn--block" data-act="report">${ICON.shield}Report this name</button><button class="btn btn--quiet" data-act="close">Close</button></div>`,
  });
  let busy = false;
  sh.scope.on(sh.el, 'click', async (ev) => {
    const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a || busy) return;
    if (a.dataset.act === 'close') return sh.close();
    busy = true;
    try {
      await leaderboard.report(e.uid);
      if (sh.scope.alive) sh.close();
      toast('Thanks. The name has been reported.');
    } catch (err) {
      busy = false;
      toast(errorText(err));
    }
  });
}
