import { Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";

const cardTitleFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "700"],
});

const cardBodyFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
});

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8 text-[#2f2418] sm:px-8 sm:py-12">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[30px] border border-[#b08a58]/40 bg-[linear-gradient(140deg,rgba(249,244,229,0.93),rgba(234,220,188,0.9))] p-5 shadow-[0_24px_60px_rgba(44,29,11,0.25)] backdrop-blur-[3px] sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(139,101,60,0.26),rgba(139,101,60,0))]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(112,75,43,0.2),rgba(112,75,43,0))]" />

        <header className="relative mb-8 border-b border-dashed border-[#89663f]/45 pb-6 sm:mb-10 sm:pb-8">
          <p
            className={`${cardBodyFont.className} mb-2 text-xs uppercase tracking-[0.3em] text-[#6a5234]`}
          >
            InkBranch Story Registry
          </p>
          <h1
            className={`${cardTitleFont.className} text-4xl leading-tight text-[#2f2418] sm:text-5xl`}
          >
            Interactive License Desk
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#58452f] sm:text-base">
            Create an InkBranch account, open your story runs, and manage your
            access path. New accounts always begin as Reader profiles.
          </p>
          <p
            className={`${cardBodyFont.className} mt-3 text-xs uppercase tracking-[0.15em] text-[#6a5234]`}
          >
            Stable spine | Flexible experience
          </p>
        </header>

        <div className="relative grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border-2 border-[#be9862]/60 bg-[linear-gradient(160deg,#f9efd3,#f4e4ba)] p-6 shadow-[0_14px_28px_rgba(95,63,29,0.18)] sm:p-7">
            <p
              className={`${cardBodyFont.className} mb-1 text-xs uppercase tracking-[0.24em] text-[#6a5234]`}
            >
              New Account
            </p>
            <h2 className={`${cardTitleFont.className} mb-5 text-3xl text-[#3b2c1c]`}>
              Create InkBranch License
            </h2>
            <form className={`${cardBodyFont.className} space-y-4 text-sm`}>
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-[#4d3a25]">
                  Profile Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Avery Knox"
                  className="w-full rounded-xl border border-[#b58f5f] bg-[#fff8e9]/80 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#cda76f]/45"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[#4d3a25]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@inkbranch.io"
                  className="w-full rounded-xl border border-[#b58f5f] bg-[#fff8e9]/80 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#cda76f]/45"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="newPin" className="mb-1.5 block text-[#4d3a25]">
                    Account Passphrase
                  </label>
                  <input
                    id="newPin"
                    name="newPin"
                    type="password"
                    placeholder="****"
                    className="w-full rounded-xl border border-[#b58f5f] bg-[#fff8e9]/80 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#cda76f]/45"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmPin"
                    className="mb-1.5 block text-[#4d3a25]"
                  >
                    Confirm Passphrase
                  </label>
                  <input
                    id="confirmPin"
                    name="confirmPin"
                    type="password"
                    placeholder="****"
                    className="w-full rounded-xl border border-[#b58f5f] bg-[#fff8e9]/80 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#cda76f]/45"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="accountPath"
                  className="mb-1.5 block text-[#4d3a25]"
                >
                  Preferred Access Path
                </label>
                <select
                  id="accountPath"
                  name="accountPath"
                  defaultValue=""
                  className="w-full rounded-xl border border-[#b58f5f] bg-[#fff8e9]/80 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#cda76f]/45"
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  <option value="reader">Reader (Free Profile)</option>
                  <option value="creator-interest">
                    Creator Interest (Apply Later)
                  </option>
                </select>
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-[#5d3f1d] px-4 py-3 text-center text-xs uppercase tracking-[0.18em] text-[#fef6e6] transition hover:bg-[#4c3216]"
              >
                Create Account
              </button>
              <p className="text-xs leading-6 text-[#5a452e]">
                Signup creates a Reader account. Author tools are enabled only
                after a separate upgrade and approval review.
              </p>
            </form>
          </section>

          <section className="rounded-2xl border-2 border-[#7a5940]/55 bg-[linear-gradient(155deg,#f6e5c0,#f0d7aa)] p-6 shadow-[0_14px_28px_rgba(95,63,29,0.2)] sm:p-7">
            <p
              className={`${cardBodyFont.className} mb-1 text-xs uppercase tracking-[0.24em] text-[#6a5234]`}
            >
              Account Access
            </p>
            <h2 className={`${cardTitleFont.className} mb-5 text-3xl text-[#3b2c1c]`}>
              Sign In
            </h2>
            <form className={`${cardBodyFont.className} space-y-4 text-sm`}>
              <div>
                <label htmlFor="accessKey" className="mb-1.5 block text-[#4d3a25]">
                  Email or Access Key
                </label>
                <input
                  id="accessKey"
                  name="accessKey"
                  type="text"
                  placeholder="reader@inkbranch.io"
                  className="w-full rounded-xl border border-[#9e7347] bg-[#fff6e2]/85 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#bd8d54]/40"
                />
              </div>
              <div>
                <label htmlFor="pin" className="mb-1.5 block text-[#4d3a25]">
                  Access Passphrase
                </label>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  placeholder="****"
                  className="w-full rounded-xl border border-[#9e7347] bg-[#fff6e2]/85 px-3 py-2.5 outline-none transition focus:border-[#6e4e2b] focus:ring-2 focus:ring-[#bd8d54]/40"
                />
              </div>
              <div className={`${cardBodyFont.className} flex items-center justify-between`}>
                <label className="inline-flex items-center gap-2 text-xs text-[#5b452d]">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    className="h-4 w-4 rounded border-[#9e7347] text-[#5d3f1d] focus:ring-[#bd8d54]"
                  />
                  Remember this device
                </label>
                <a
                  href="#"
                  className="text-xs text-[#5d3f1d] underline decoration-[#7d5b34]/70 underline-offset-2"
                >
                  Forgot passphrase?
                </a>
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-[#6a4524] px-4 py-3 text-center text-xs uppercase tracking-[0.18em] text-[#fdf5e5] transition hover:bg-[#57381d]"
              >
                Open Dashboard
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-dashed border-[#8f6b45]/65 bg-[#f5e5bf]/70 p-4">
              <p
                className={`${cardBodyFont.className} text-xs uppercase tracking-[0.16em] text-[#664e33]`}
              >
                Role Policy
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-7 text-[#4b3926]">
                <li>Reader: free profile with story purchases.</li>
                <li>Author: paid tools and workspace after approval.</li>
                <li>Admin: assigned manually by platform owner only.</li>
              </ul>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
