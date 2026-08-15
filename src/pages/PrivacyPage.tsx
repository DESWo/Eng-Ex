/** Plain-language privacy statement. */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="label-caps text-ink-soft dark:text-stone-400">Privacy</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Your work stays on this device
      </h1>
      <p className="mt-3 text-ink-soft dark:text-stone-400">
        Engineering Explorer has no server. That makes the privacy story short.
      </p>

      <div className="mt-8 space-y-8 text-[0.95rem] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-bold tracking-tight">Nothing is uploaded</h2>
          <p className="mt-2 text-ink-soft dark:text-stone-300">
            The whole app runs in your browser. Your progress, stars, and reflection answers are
            saved in this browser's local storage and never sent anywhere. If you clear this
            browser's site data, that work is gone, which is why the Backup button exists.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold tracking-tight">
            No accounts, no passwords
          </h2>
          <p className="mt-2 text-ink-soft dark:text-stone-300">
            Signing in asks for an email, but it is only a name tag. It tells the app whose saved
            work to load when a class shares one computer. There is no password because there is no
            server to check one against, and the sign-in dialog says so. The email never leaves
            this browser, and anyone using this computer can open the work saved on it, so do not
            put anything private in here.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold tracking-tight">
            No analytics, no trackers
          </h2>
          <p className="mt-2 text-ink-soft dark:text-stone-300">
            There are no analytics scripts, no tracking cookies, and no ad pixels. Nobody is
            counting what you click. Even the fonts are served from this site itself, so opening a
            page makes no requests to anyone else's servers.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Save files are yours
          </h2>
          <p className="mt-2 text-ink-soft dark:text-stone-300">
            The Backup button exports your progress as a file that downloads to your device. You
            decide where it goes and who sees it. Restoring reads a file you choose. The app never
            touches either one after that.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold tracking-tight">If that changes</h2>
          <p className="mt-2 text-ink-soft dark:text-stone-300">
            Real accounts with a server are a possibility later. If that happens, this page will
            change first, before any data does.
          </p>
        </section>
      </div>
    </div>
  )
}
