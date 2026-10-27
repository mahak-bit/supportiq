import { ButtonLink, Wordmark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grain grid min-h-dvh place-items-center px-5">
      <div className="text-center">
        <Wordmark className="justify-center" />
        <h1 className="font-display mt-10 text-[2.4rem] text-fg">This page isn’t here</h1>
        <p className="mt-2 text-fg-soft">The link may be out of date. The inbox is a good place to start.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/app/inbox">Go to the inbox</ButtonLink>
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
        </div>
      </div>
    </main>
  );
}
