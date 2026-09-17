/* NULL · Profile.tsx
   Two screens wearing one page. Signed out it is a sign-in card; signed in it
   is the player card, the library strip and the account list.

   The account is local: a handle, a salted hash, and the card. Nothing is
   sent anywhere, which is why there is no email field and no reset flow.

   The profile effects are not painted behind this card any more: a wide
   looping clip was being squashed into a strip and tinted until nothing of
   it survived. They belong to the share card, which is the size they were
   made for (src/components/ShareCard.tsx). */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Clock,
  CloudDownload,
  CloudUpload,
  Coins,
  Gamepad2,
  LogOut,
  Crown,
  Lock,
  Palette,
  Share2,
  Pencil,
  RotateCcw,
  Star,
  Trophy,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import {
  account,
  BANNER_SWATCHES,
  changePassword,
  changeUser,
  deleteAccount,
  markBackup,
  NAME_FONTS,
  nameStyleCss,
  pushRecent,
  signIn,
  signOut,
  signUp,
  useAccount,
  verifyPassword,
  type NameStyle,
} from "../lib/account";
import { AvatarArt } from "../lib/art";
import { NullFace } from "../lib/brand";
import { remember } from "../lib/members";
import { ShareCard } from "../components/ShareCard";
import { itemOf, useEcon } from "../lib/econ";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { entries } from "../lib/catalog";
import { openTab } from "../lib/tabs";
import { Sheet } from "../components/Sheet";

export function Profile() {
  const me = useAccount();
  if (!me.user) return <SignIn />;
  return <SignedIn />;
}

/* ============================================================
   signed out
   ============================================================ */
function SignIn() {
  /* first visit lands on sign in, the way the spec asks: "Welcome back" */
  const [mode, setMode] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "in") {
      const r = signIn(user, pass);
      if (!r.ok) setError(r.error ?? "No.");
      return;
    }
    setBusy(true);
    /* the button says Processing… for a beat, the way a real sign up does */
    window.setTimeout(() => {
      const r = signUp(user, pass, confirm);
      setBusy(false);
      if (!r.ok) setError(r.error ?? "No.");
    }, 520);
  };

  return (
    <div className="page pf-gate">
      <form className="card card--pad pf-auth" onSubmit={submit}>
        <h1 className="pf-auth-h">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="pf-auth-sub muted">{mode === "in" ? "Sign in to continue" : "Join null"}</p>

        <label className="pf-field">
          <UserRound />
          <input
            value={user}
            autoComplete="username"
            placeholder="Username"
            spellCheck={false}
            onChange={(e) => setUser(e.target.value)}
          />
        </label>

        <label className="pf-field">
          <Lock />
          <input
            type="password"
            value={pass}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder="Password"
            onChange={(e) => setPass(e.target.value)}
          />
        </label>

        {mode === "up" && (
          <label className="pf-field">
            <Lock />
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              placeholder="Confirm Password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}

        {error && <p className="form-err">{error}</p>}

        <button className="btn btn--fill pf-submit" type="submit" disabled={busy}>
          {busy ? "Processing…" : mode === "in" ? "Sign in" : "Sign up"}
          {!busy && <ArrowRight />}
        </button>

        <p className="pf-swap">
          {mode === "in" ? (
            <>
              Don’t have an account?{" "}
              <button type="button" className="linkish" onClick={() => setMode("up")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button type="button" className="linkish" onClick={() => setMode("in")}>
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="tiny faint pf-tip">
          <Lock /> Letters, numbers, . - and _ for the handle. The account lives in this
          browser: no email, no server, nothing to leak.
        </p>
      </form>
    </div>
  );
}

/* ============================================================
   signed in
   ============================================================ */
function SignedIn() {
  const me = useAccount();
  const eco = useEcon();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: me.name, bio: me.bio });
  const [bioOpen, setBioOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const tag = itemOf(eco.equipped.tag);
  const avatar = eco.equipped.avatar;
  /* the owner wears their own tag, on top of whatever they picked up in the
     shop — the two sit side by side rather than replacing each other */
  const owner = isOwner(me.user);

  /* Being on this page is what puts you on the members list, and every edit
     here updates that card — the page itself says it only knows browsers. */
  useEffect(() => {
    remember(me, eco);
  }, [me, eco]);

  const startEdit = () => {
    setDraft({ name: me.name, bio: me.bio });
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft({ name: me.name, bio: me.bio });
    setEditing(false);
    setBioOpen(false);
  };
  const saveEdit = () => {
    account.set({ name: draft.name.trim() || me.user || "someone", bio: draft.bio.trim() });
    setEditing(false);
    setBioOpen(false);
  };

  const recent = entries("game")
    .filter((e) => me.recent.some((r) => r.id === e.id))
    .slice(0, 6);

  return (
    <div className="page">
      <section className="card pf-card">
        <div className="pf-banner" style={{ background: me.banner }}>
          <button className="btn btn--sm pf-banner-edit" onClick={() => setBannerOpen(true)}>
            <Palette /> Edit banner
          </button>
        </div>

        <div className="pf-id">
          <div className="pf-pic-wrap">
            <span className="pf-pic">
              {me.pfp ? <img src={me.pfp} alt="" /> : <NullFace />}
              <AvatarArt id={avatar} />
            </span>
            <label className="pf-cam" title="Change picture">
              <Camera />
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fr = new FileReader();
                  fr.onload = () => account.set({ pfp: String(fr.result) });
                  fr.readAsDataURL(f);
                }}
              />
            </label>
          </div>

          <div className="pf-txt">
            {/* the badge sits beside the name, not inside it: the name can be
                a gradient cut out of its own text, which would eat the icon */}
            <div className="pf-name-row">
              <h1 className="pf-name" style={nameStyleCss(me.nameStyle)}>
                {editing ? (
                  <input
                    className="pf-name-in"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    aria-label="Display name"
                    autoFocus
                  />
                ) : (
                  me.name
                )}
              </h1>
              {owner && !editing && <BadgeCheck className="pf-verified" aria-label="Owner" />}
            </div>
            <span className="pf-handle">@{me.user}</span>

            {(owner || tag) && (
              <div className="pf-tags">
                {owner && (
                  <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
                    <Crown />
                    {OWNER_TAG.name}
                  </span>
                )}
                {tag && (
                  <span className="tagchip" style={{ background: tag.color, color: "#0b0b0d" }}>
                    {tag.name}
                  </span>
                )}
              </div>
            )}

            <div className="pf-meta">
              <span className="pf-chip">
                <Clock /> joined {new Date(me.joined || Date.now()).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="pf-chip">
                <Coins /> {eco.coins.toLocaleString()}
              </span>
              <span className="pf-chip">
                <Trophy /> {me.favorites.length} achievements
              </span>
            </div>
          </div>

          <div className="pf-id-actions">
            {editing ? (
              <>
                <button className="btn btn--icon" onClick={cancelEdit} aria-label="Cancel">
                  <X />
                </button>
                <button className="btn btn--icon btn--fill" onClick={saveEdit} aria-label="Save">
                  <Check />
                </button>
              </>
            ) : (
              <button className="btn" onClick={startEdit}>
                <Pencil /> Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="pf-bio">
          {editing && bioOpen ? (
            <>
              <textarea
                className="fld fld--area"
                value={draft.bio}
                autoFocus
                placeholder="Add a bio..."
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
              <div className="pf-bio-actions">
                <button className="btn btn--quiet" onClick={() => { setBioOpen(false); setDraft({ ...draft, bio: me.bio }); }}>
                  Cancel
                </button>
                <button className="btn btn--fill btn--sm" onClick={saveEdit}>
                  Save
                </button>
              </div>
            </>
          ) : (
            <button
              className="pf-bio-box"
              onClick={() => {
                if (!editing) startEdit();
                setBioOpen(true);
              }}
            >
              {me.bio || "Add a bio..."}
            </button>
          )}
        </div>
      </section>

      <h2 className="pf-h">Library</h2>
      <div className="pf-libgrid">
        <LibCard icon={<Gamepad2 />} label="Games" value={entries("game").length} />
        <LibCard icon={<Trophy />} label="Titles" value={me.favorites.length} />
        <LibCard icon={<Clock />} label="Recent" value={me.recent.length} />
        <LibCard icon={<Star />} label="Favorites" value={me.favorites.length} />
      </div>

      <h3 className="pf-h pf-h--sub">Recently played</h3>
      {recent.length === 0 ? (
        <p className="faint tiny">Nothing played yet. Games you launch show up here.</p>
      ) : (
        <div className="pf-recent">
          {recent.map((e) => (
            <button
              key={e.id}
              className="tile tile--sm"
              onClick={() => {
                pushRecent("game", e.id);
                openTab({ page: "player", arg: { kind: "game", id: e.id, title: e.name } });
              }}
              title={e.name}
            >
              <span className="tile-btn">
                {e.thumb ? <img src={e.thumb} alt="" /> : <span className="tile-blank"><Gamepad2 /></span>}
              </span>
              <span className="tile-name">{e.name}</span>
            </button>
          ))}
        </div>
      )}

      <AccountCard />

      <Sheet open={bannerOpen} onClose={() => setBannerOpen(false)} title="Banner" width={560}>
        <BannerEditor />
      </Sheet>
      <button className="pf-shot" onClick={() => setShareOpen(true)} title="Share card">
        <Share2 />
      </button>

      <ShareCard open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function LibCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card pf-libcard">
      {icon}
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}

/* ============================================================
   banner
   ============================================================ */
function BannerEditor() {
  const me = useAccount();
  const [value, setValue] = useState(me.banner);
  const [pick, setPick] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<string | null>(null);
  const [zoom, setZoom] = useState(140);
  const [posY, setPosY] = useState(50);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = () => {
    account.set({ banner: value });
  };

  return (
    <div className="banner-ed">
      <p className="pf-label">Banner</p>
      <div className="swatchgrid">
        {BANNER_SWATCHES.map((c) => (
          <button
            key={c}
            className={`swatch${pick === c ? " is-on" : ""}`}
            style={{ background: `linear-gradient(135deg, ${c}, #2e2e33)` }}
            onClick={() => {
              setPick(c);
              setValue(`linear-gradient(135deg, ${c} 0%, #2e2e33 100%)`);
            }}
            aria-label={c}
          />
        ))}
      </div>

      <label className="form-row">
        <span>Free form</span>
        <input
          className="fld"
          value={value}
          spellCheck={false}
          placeholder="#6272a4 or a CSS gradient"
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="tiny faint">Enter a color, gradient, or image URL.</p>

      <div className="banner-actions">
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload /> Upload image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = () => setAdjust(String(fr.result));
            fr.readAsDataURL(f);
          }}
        />
        <div className="row">
          <button className="btn" onClick={() => { setValue("linear-gradient(135deg, #6d4bd8 0%, #4a4a58 55%, #2e2e33 100%)"); setPick(null); }}>
            Reset
          </button>
          <button className="btn btn--fill" onClick={apply}>
            Save
          </button>
        </div>
      </div>

      <div className="banner-preview" style={{ background: value }} />

      <Sheet open={!!adjust} onClose={() => setAdjust(null)} title="Adjust banner" width={520}>
        <p className="muted">Drag to reposition. Scroll or use the slider to resize.</p>
        <div
          className="adjust-box"
          style={{
            backgroundImage: `url(${adjust})`,
            backgroundSize: `${zoom}% auto`,
            backgroundPosition: `center ${posY}%`,
          }}
        />
        <input
          className="adjust-slider"
          type="range"
          min={100}
          max={320}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
        />
        <div className="adjust-actions">
          <button className="btn" onClick={() => { setZoom(140); setPosY(50); }}>
            Reset
          </button>
          <div className="row">
            <button className="btn" onClick={() => setAdjust(null)}>
              Cancel
            </button>
            <button
              className="btn btn--fill"
              onClick={() => {
                setBusy(true);
                window.setTimeout(() => {
                  setValue(`url(${adjust}) center ${posY}% / ${zoom}% auto no-repeat`);
                  setBusy(false);
                  setAdjust(null);
                }, 420);
              }}
            >
              {busy ? "Uploading…" : "Apply"}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ============================================================
   the account list
   ============================================================ */
function AccountCard() {
  const me = useAccount();
  const [userOpen, setUserOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const lastBackup = me.lastBackup || me.joined;

  return (
    <section className="card pf-account">
      <h2 className="pf-account-h">Account</h2>

      <Row
        title="Username"
        sub={`@${me.user}`}
        note="Can change once every 14 days"
        action={
          <button className="btn btn--sm" onClick={() => setUserOpen(true)}>
            Change
          </button>
        }
      />
      <Row
        title="Password"
        sub="••••••••••"
        action={
          <button className="btn btn--sm" onClick={() => setPassOpen(true)}>
            Change
          </button>
        }
      />
      <Row
        title="Game Saves"
        sub={`Last backed up ${new Date(lastBackup || Date.now()).toLocaleString()}`}
        action={
          <div className="row">
            <button
              className="btn btn--sm"
              onClick={() => {
                markBackup();
                setNote("Saves backed up in this browser.");
              }}
            >
              <CloudUpload /> Back up
            </button>
            <button className="btn btn--sm" onClick={() => setNote("Nothing newer to restore.")}>
              <CloudDownload /> Restore
            </button>
          </div>
        }
      />

      <CardGradient />
      <NameStyleRow />

      <Row
        title="Log out"
        sub="Sign out of null on this device."
        action={
          <button className="btn btn--sm" onClick={signOut}>
            <LogOut /> Log out
          </button>
        }
      />
      <Row
        danger
        title="Delete account"
        sub="Permanently delete your account and data."
        action={
          <button className="btn btn--sm btn--bad" onClick={() => setDelOpen(true)}>
            <Trash2 /> Delete
          </button>
        }
      />

      <Sheet open={userOpen} onClose={() => setUserOpen(false)} title="Change username" width={420}>
        <UserChange onDone={(m) => { setNote(m); setUserOpen(false); }} />
      </Sheet>

      <Sheet open={passOpen} onClose={() => setPassOpen(false)} title="Change password" width={420}>
        <PassChange onDone={(m) => { setNote(m); setPassOpen(false); }} />
      </Sheet>

      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Delete account" width={420}>
        <DeleteCheck onDone={(m) => { setNote(m); setDelOpen(false); }} />
      </Sheet>

      {note && <div className="toast">{note}</div>}
    </section>
  );
}

function Row({
  title,
  sub,
  note,
  action,
  danger,
}: {
  title: string;
  sub?: string;
  note?: string;
  action: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`pf-row${danger ? " pf-row--danger" : ""}`}>
      <div className="pf-row-txt">
        <b>{title}</b>
        {sub && <span className="pf-row-sub">{sub}</span>}
        {note && <span className="pf-row-note tiny faint">{note}</span>}
      </div>
      <div className="pf-row-act">{action}</div>
    </div>
  );
}

function CardGradient() {
  const me = useAccount();
  const card = me.card ?? { top: "#6d4bd8", bottom: "#2e2e33" };
  return (
    <div className="pf-row">
      <div className="pf-row-txt">
        <b>Profile card gradient</b>
        <span className="pf-row-sub">Two colors, top to bottom. Shown behind your profile card.</span>
      </div>
      <div className="pf-row-act">
        <span
          className="grad-prev"
          style={{ background: `linear-gradient(180deg, ${card.top}, ${card.bottom})` }}
        />
        <input
          type="color"
          value={card.top}
          aria-label="Top color"
          onChange={(e) => account.set({ card: { ...card, top: e.target.value } })}
        />
        <input
          type="color"
          value={card.bottom}
          aria-label="Bottom color"
          onChange={(e) => account.set({ card: { ...card, bottom: e.target.value } })}
        />
        <button className="btn btn--sm btn--fill" onClick={() => account.set({ card })}>
          Save
        </button>
        <button className="btn btn--sm" onClick={() => account.set({ card: null })}>
          Clear
        </button>
      </div>
    </div>
  );
}

function NameStyleRow() {
  const me = useAccount();
  const [style, setStyle] = useState<NameStyle>(me.nameStyle);

  const set = (patch: Partial<NameStyle>) => setStyle({ ...style, ...patch });

  return (
    <>
      <div className="pf-row pf-row--stack">
        <div className="pf-row-txt">
          <b>Username style</b>
          <span className="pf-row-sub">Applied to your display name on site and profile cards.</span>
        </div>
      </div>
      <div className="pf-style">
        <div className="pf-style-prev">
          <span style={nameStyleCss(style)}>{me.name}</span>
        </div>

        <div className="pf-style-row">
          <button
            className={`seg${style.mode === "solid" ? " is-on" : ""}`}
            onClick={() => set({ mode: "solid" })}
          >
            Solid
          </button>
          <button
            className={`seg${style.mode === "gradient" ? " is-on" : ""}`}
            onClick={() => set({ mode: "gradient" })}
          >
            Gradient
          </button>
          <input
            type="color"
            value={style.c1}
            aria-label="Name colour"
            onChange={(e) => set({ c1: e.target.value })}
          />
          {style.mode === "gradient" && (
            <input
              type="color"
              value={style.c2}
              aria-label="Second colour"
              onChange={(e) => set({ c2: e.target.value })}
            />
          )}
          <label className="check">
            <input type="checkbox" checked={style.glow} onChange={(e) => set({ glow: e.target.checked })} />
            Add glow
          </label>
          {style.glow && (
            <input
              type="color"
              value={style.glowColor}
              aria-label="Glow colour"
              onChange={(e) => set({ glowColor: e.target.value })}
            />
          )}
        </div>

        <label className="form-row pf-style-font">
          <span className="tiny">Font</span>
          <select className="fld" value={style.font} onChange={(e) => set({ font: e.target.value })}>
            {NAME_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <div className="pf-style-actions">
          <button className="btn btn--sm" onClick={() => setStyle(me.nameStyle)}>
            <RotateCcw /> Reset
          </button>
          <button className="btn btn--sm btn--fill" onClick={() => account.set({ nameStyle: style })}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

function UserChange({ onDone }: { onDone: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="form">
      <label className="form-row">
        <span>New username</span>
        <input className="fld" value={name} spellCheck={false} onChange={(e) => setName(e.target.value)} />
      </label>
      {err && <p className="form-err">{err}</p>}
      <div className="form-actions">
        <button
          className="btn btn--fill"
          onClick={() => {
            const r = changeUser(name.trim());
            if (!r.ok) return setErr(r.error ?? "No.");
            onDone("Username changed.");
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function PassChange({ onDone }: { onDone: (msg: string) => void }) {
  const [old, setOld] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="form">
      <label className="form-row">
        <span>Current password</span>
        <input className="fld" type="password" value={old} onChange={(e) => setOld(e.target.value)} />
      </label>
      <label className="form-row">
        <span>New password</span>
        <input className="fld" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Again</span>
        <input className="fld" type="password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </label>
      {err && <p className="form-err">{err}</p>}
      <div className="form-actions">
        <button
          className="btn btn--fill"
          onClick={() => {
            const r = changePassword(old, next, again);
            if (!r.ok) return setErr(r.error ?? "No.");
            onDone("Password changed.");
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function DeleteCheck({ onDone }: { onDone: (msg: string) => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ok = useMemo(() => verifyPassword(pass), [pass]);
  return (
    <div className="form">
      <p className="muted">
        This wipes the profile, the coins and every save in this browser. Type the password
        to confirm.
      </p>
      <label className="form-row">
        <span>Password</span>
        <input className="fld" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      {err && <p className="form-err">{err}</p>}
      <div className="form-actions">
        <button
          className="btn btn--bad"
          disabled={!ok}
          onClick={() => {
            if (!ok) return setErr("That password is not it.");
            deleteAccount();
            onDone("Account deleted.");
          }}
        >
          <Trash2 /> Delete everything
        </button>
      </div>
    </div>
  );
}

