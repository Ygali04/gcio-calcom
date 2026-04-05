"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";

import { OnboardingCard } from "../components/OnboardingCard";
import { OnboardingLayout } from "../components/OnboardingLayout";
import { useOnboardingStore } from "../store/onboarding-store";

type OnboardingViewProps = {
  userEmail: string;
};

// GCIO: Plan selection is skipped — all users go through the personal onboarding flow.
export const OnboardingView = ({ userEmail }: OnboardingViewProps) => {
  const router = useRouter();
  const { t } = useLocale();
  const { setSelectedPlan } = useOnboardingStore();
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSelectedPlan("personal");
    startTransition(() => {
      router.push("/onboarding/personal/settings");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingLayout userEmail={userEmail}>
      <OnboardingCard
        title="Welcome to Global CIO Circle"
        subtitle="Setting up your scheduling profile..."
      />
    </OnboardingLayout>
  );
};
