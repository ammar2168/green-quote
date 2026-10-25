import Link from "next/link";

import { HeroArt } from "@/components/hero-art";
import { LogoMark } from "@/components/logo";
import {
  SiteFooter,
  SiteHeader,
  secondaryButton,
} from "@/components/site-chrome";

/**
 * Shared by /login and /signup. The hero and card frame live here rather than
 * in each page, so switching between the two tabs keeps them mounted instead
 * of replaying their entrance animation.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader
        action={
          <Link href="/login" className={secondaryButton}>
            Sign in
          </Link>
        }
      />

      <main className="flex-1">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:py-16 lg:grid-cols-[1fr_28rem] lg:items-stretch lg:gap-8">
          <div className="relative h-36 animate-rise overflow-hidden rounded-[1.5rem] bg-panel shadow-lift sm:h-48 lg:h-auto lg:rounded-[2rem]">
            <HeroArt className="absolute inset-0 h-full w-full animate-ken-burns" />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/10 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 hidden p-8 text-white lg:block">
              <p className="text-2xl font-semibold tracking-tight text-balance">
                Your roof, your numbers: price, risk band and monthly payments
                in a minute.
              </p>
              <p className="mt-2 text-sm text-white/80">
                No credit check. Every quote is saved to your account.
              </p>
            </div>
          </div>

          <div className="animate-rise rounded-card border border-line bg-surface p-6 shadow-lift sm:p-8 lg:[animation-delay:120ms]">
            <LogoMark className="size-10" />
            {children}
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
