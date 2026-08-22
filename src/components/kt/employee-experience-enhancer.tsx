import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EmployeeFeedbackCenter } from "@/components/kt/employee-feedback-center";
import { EmployeeSuggestionsCenter } from "@/components/kt/employee-suggestions-center";
import { filialNome } from "@/lib/kt-data";
import { useColaboradores, useSession } from "@/lib/kt-store";

type Hosts = {
  suggestions: HTMLElement | null;
  feedback: HTMLElement | null;
};

const BIRTHDAY_PARTICLES = [
  "🎈",
  "🎂",
  "🎉",
  "🥳",
  "✨",
  "❤️",
  "🎊",
  "🎈",
  "🎂",
  "✨",
  "🎉",
  "🥳",
  "❤️",
  "🎈",
];

function replaceClientFacingRhCopy(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  nodes.forEach((node) => {
    const value = node.nodeValue;
    if (!value) return;
    const next = value
      .replaceAll("equipe Azumi RH", "RH")
      .replaceAll("Equipe Azumi RH", "RH")
      .replaceAll("Azumi RH", "RH")
      .replaceAll("Azumi", "RH");
    if (next !== value) node.nodeValue = next;
  });
}

function setStyleIfChanged(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

function syncEmployeeAccent(root: HTMLElement) {
  const colorSource = root.querySelector<HTMLElement>(
    '.employee-profile-card button[aria-label="Trocar foto"]',
  );
  const color = colorSource?.style.backgroundColor;
  if (!color) return;

  setStyleIfChanged(root, "--employee-accent", color);
  setStyleIfChanged(
    root,
    "--employee-accent-soft",
    `color-mix(in srgb, ${color} 12%, var(--card))`,
  );
  setStyleIfChanged(
    root,
    "--employee-accent-border",
    `color-mix(in srgb, ${color} 28%, var(--border))`,
  );

  const profileSurface = root.querySelector<HTMLElement>(".employee-profile-card > .surface");
  if (profileSurface) {
    setStyleIfChanged(profileSurface, "border-top", `4px solid ${color}`);
    setStyleIfChanged(
      profileSurface,
      "box-shadow",
      `0 18px 48px -34px color-mix(in srgb, ${color} 62%, transparent)`,
    );
  }

  const profileTitle = root.querySelector<HTMLElement>(".employee-profile-card h1");
  if (profileTitle) setStyleIfChanged(profileTitle, "color", color);

  root
    .querySelectorAll<HTMLElement>(
      '[aria-label="Atalhos do colaborador"], [aria-label="Navegação do colaborador"]',
    )
    .forEach((nav) => {
      setStyleIfChanged(
        nav,
        "border-color",
        `color-mix(in srgb, ${color} 26%, var(--border))`,
      );
    });
}

export function EmployeeExperienceEnhancer() {
  const [session] = useSession();
  const [colaboradores] = useColaboradores();
  const [hosts, setHosts] = useState<Hosts>({ suggestions: null, feedback: null });
  const [birthdayBurst, setBirthdayBurst] = useState<{ id: number; emoji: string } | null>(null);

  const cargoLabels = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return new Set<string>();
    return new Set(
      colaboradores
        .filter((item) => item.filial === session.filial)
        .map((item) => item.cargo?.trim())
        .filter((value): value is string => Boolean(value)),
    );
  }, [colaboradores, session]);

  useEffect(() => {
    if (!session || session.tipo !== "colaborador") return;
    const root = document.querySelector<HTMLElement>("[data-employee-workspace]");
    if (!root) return;

    let suggestionHost: HTMLElement | null = null;
    let feedbackHost: HTMLElement | null = null;
    let celebrationTimer: number | null = null;
    const changedIds: Array<{ element: HTMLElement; id: string }> = [];
    const hiddenElements: Array<{ element: HTMLElement; display: string }> = [];

    const hide = (element: HTMLElement | null) => {
      if (!element || hiddenElements.some((item) => item.element === element)) return;
      hiddenElements.push({ element, display: element.style.display });
      element.style.display = "none";
    };

    const replaceLegacySection = (legacyId: string, hostId: string) => {
      const legacy = document.getElementById(legacyId);
      if (!legacy || legacy.dataset["ktReplaced"] === "true") return null;
      const host = document.createElement("div");
      host.id = hostId;
      host.className = "min-w-0 scroll-mt-24";
      legacy.parentElement?.insertBefore(host, legacy);
      changedIds.push({ element: legacy, id: legacy.id });
      legacy.id = `${legacyId}-legacy`;
      legacy.dataset["ktReplaced"] = "true";
      hide(legacy);
      return host;
    };

    suggestionHost = replaceLegacySection("sugestoes", "sugestoes");
    feedbackHost = replaceLegacySection("feedback", "feedback");
    hide(document.getElementById("minhas-sugestoes"));
    hide(document.getElementById("meus-feedbacks"));

    if (suggestionHost || feedbackHost) {
      setHosts({ suggestions: suggestionHost, feedback: feedbackHost });
    }

    const tidyBirthday = () => {
      const section = document.getElementById("aniversariantes");
      if (!section) return;

      section.querySelectorAll<HTMLElement>("p").forEach((paragraph) => {
        const text = paragraph.textContent?.trim() ?? "";
        if (text.startsWith("Quem faz aniversário este mês na unidade")) {
          paragraph.textContent = "Aniversários deste mês. Celebre quem faz parte do time.";
        }
      });

      const branch = filialNome(session.filial);
      section.querySelectorAll<HTMLElement>("span").forEach((badge) => {
        const text = badge.textContent?.trim() ?? "";
        if (text === branch || cargoLabels.has(text)) {
          badge.style.display = "none";
        }
      });
    };

    const tidy = () => {
      replaceClientFacingRhCopy(root);
      syncEmployeeAccent(root);
      tidyBirthday();
    };

    const onBirthdayClick = (event: Event) => {
      const section = document.getElementById("aniversariantes");
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!section || !button || !section.contains(button)) return;
      const text = button.textContent ?? "";
      const emoji = ["🎈", "🎂", "❤️", "🥳", "🎉"].find((candidate) => text.includes(candidate));
      if (!emoji) return;
      setBirthdayBurst({ id: Date.now(), emoji });
      if (celebrationTimer) window.clearTimeout(celebrationTimer);
      celebrationTimer = window.setTimeout(() => setBirthdayBurst(null), 1500);
    };

    tidy();
    root.addEventListener("click", onBirthdayClick, true);
    const observer = new MutationObserver(tidy);
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
      root.removeEventListener("click", onBirthdayClick, true);
      if (celebrationTimer) window.clearTimeout(celebrationTimer);
      root.style.removeProperty("--employee-accent");
      root.style.removeProperty("--employee-accent-soft");
      root.style.removeProperty("--employee-accent-border");
      suggestionHost?.remove();
      feedbackHost?.remove();
      hiddenElements.forEach(({ element, display }) => {
        element.style.display = display;
        delete element.dataset["ktReplaced"];
      });
      changedIds.forEach(({ element, id }) => {
        element.id = id;
      });
      setHosts({ suggestions: null, feedback: null });
    };
  }, [session, cargoLabels]);

  return (
    <>
      {hosts.suggestions ? createPortal(<EmployeeSuggestionsCenter />, hosts.suggestions) : null}
      {hosts.feedback ? createPortal(<EmployeeFeedbackCenter />, hosts.feedback) : null}
      {birthdayBurst && typeof document !== "undefined"
        ? createPortal(
            <div
              key={birthdayBurst.id}
              className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
              aria-hidden="true"
            >
              {BIRTHDAY_PARTICLES.map((particle, index) => (
                <span
                  key={`${birthdayBurst.id}-${index}`}
                  className="kt-mood-particle"
                  style={{
                    left: `${5 + ((index * 19) % 90)}%`,
                    top: `${42 + (index % 4) * 7}%`,
                    animationDelay: `${(index % 6) * 45}ms`,
                    animationDuration: `${900 + (index % 4) * 140}ms`,
                    fontSize: `${20 + (index % 3) * 7}px`,
                  }}
                >
                  {index % 4 === 0 ? birthdayBurst.emoji : particle}
                </span>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
