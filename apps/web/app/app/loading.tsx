import { AppContentFallback } from "@/components/app-content-fallback";

export default function AppLoading() {
  return (
    <AppContentFallback
      title="Opening the next workspace view"
      description="The arena is preparing the page, syncing the shell and loading the latest data."
    />
  );
}
