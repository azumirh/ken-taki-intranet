import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

const MOBILE_CLASS = "kt-employee-mobile-runtime";

const RUNTIME_CSS = `
html.${MOBILE_CLASS},
html.${MOBILE_CLASS} body {
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: clip !important;
}

html.${MOBILE_CLASS} body:has([data-employee-workspace]) main.app-container {
  width: 100% !important;
  max-width: 100% !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
  box-sizing: border-box !important;
  overflow-x: clip !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  overflow-x: clip !important;
  box-sizing: border-box !important;
  padding-bottom: 5.75rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] > *,
html.${MOBILE_CLASS} [data-employee-workspace] section,
html.${MOBILE_CLASS} [data-employee-workspace] article,
html.${MOBILE_CLASS} [data-employee-workspace] form,
html.${MOBILE_CLASS} [data-employee-workspace] .surface,
html.${MOBILE_CLASS} [data-employee-workspace] .grid,
html.${MOBILE_CLASS} [data-employee-workspace] .flex,
html.${MOBILE_CLASS} [data-employee-workspace] .flex-1,
html.${MOBILE_CLASS} [data-employee-workspace] .min-w-0 {
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] section {
  width: 100% !important;
  overflow: hidden !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] section > header,
html.${MOBILE_CLASS} [data-employee-workspace] section > header > div,
html.${MOBILE_CLASS} [data-employee-workspace] section > div:not(.overflow-x-auto) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] section > header {
  flex-direction: column !important;
  align-items: stretch !important;
  gap: .75rem !important;
  padding: 1rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] section > div:not(.overflow-x-auto) {
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :where(h1,h2,h3,h4,p,span,label,a,button) {
  max-width: 100% !important;
  overflow-wrap: anywhere !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :where(input,select,textarea) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  font-size: 16px !important;
  box-sizing: border-box !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :where(img,iframe,video) {
  max-width: 100% !important;
}

html.${MOBILE_CLASS} nav[aria-label="Atalhos do colaborador"] {
  display: none !important;
}

html.${MOBILE_CLASS} nav[aria-label="Navegação do colaborador"] {
  display: block !important;
  position: fixed !important;
  inset-inline: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  z-index: 999 !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :is(#noticias,#politicas,#reconhecimentos,#feedback,#feedback-colaborador,#pesquisa-clima,#integracao) .grid {
  grid-template-columns: minmax(0,1fr) !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #employee-checkin-clean .grid-cols-5 {
  display: grid !important;
  width: 100% !important;
  grid-template-columns: repeat(5,minmax(0,1fr)) !important;
  gap: .25rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #employee-checkin-clean .grid-cols-5 > button {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  padding: .55rem .1rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #employee-checkin-clean .grid-cols-5 > button > span:first-child {
  width: 2.15rem !important;
  height: 2.15rem !important;
  min-width: 2.15rem !important;
  font-size: 1.35rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #employee-checkin-clean .grid-cols-5 > button > span:last-child {
  width: 100% !important;
  min-width: 0 !important;
  font-size: .58rem !important;
  line-height: 1.05 !important;
  white-space: normal !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #noticias article,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias article > div,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias .aspect-video,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias iframe,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias video,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias img,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias .kt-content-actions-host {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #noticias .aspect-video {
  aspect-ratio: 16/9 !important;
  overflow: hidden !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #noticias .kt-content-actions-host > div {
  display: grid !important;
  width: 100% !important;
  grid-template-columns: repeat(2,minmax(0,1fr)) !important;
  gap: .5rem !important;
  padding: .8rem 1rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #noticias .kt-content-actions-host > div > span,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias .kt-content-actions-host > div > a {
  grid-column: 1/-1 !important;
  width: 100% !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #noticias .kt-content-actions-host button,
html.${MOBILE_CLASS} [data-employee-workspace] #noticias .kt-content-actions-host a {
  min-width: 0 !important;
  justify-content: center !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #politicas article,
html.${MOBILE_CLASS} [data-employee-workspace] #politicas article > div,
html.${MOBILE_CLASS} [data-employee-workspace] #politicas article .flex-1,
html.${MOBILE_CLASS} [data-employee-workspace] #politicas article button {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #politicas article button {
  display: inline-flex !important;
  justify-content: center !important;
  white-space: normal !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #reconhecimentos > div,
html.${MOBILE_CLASS} [data-employee-workspace] #reconhecimentos .flex-1,
html.${MOBILE_CLASS} [data-employee-workspace] #feedback > div,
html.${MOBILE_CLASS} [data-employee-workspace] #feedback-colaborador > div {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #feedback > header .shrink-0,
html.${MOBILE_CLASS} [data-employee-workspace] #feedback > header .shrink-0 > div,
html.${MOBILE_CLASS} [data-employee-workspace] #feedback-colaborador header > div {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #feedback > header .shrink-0 > div,
html.${MOBILE_CLASS} [data-employee-workspace] #feedback-colaborador header > div {
  display: grid !important;
  grid-template-columns: minmax(0,1fr) !important;
  gap: .5rem !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :is(#feedback,#feedback-colaborador) button {
  min-width: 0 !important;
  max-width: 100% !important;
  white-space: normal !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #pesquisa-clima article {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  flex-direction: column !important;
  align-items: stretch !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #pesquisa-clima article > div {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #pesquisa-clima article > div:last-child > * {
  width: 100% !important;
  justify-content: center !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :is(#mural,#aniversariantes) .overflow-x-auto {
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scrollbar-width: none !important;
  -webkit-overflow-scrolling: touch !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] :is(#mural,#aniversariantes) .overflow-x-auto::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #mural article {
  width: min(84vw,360px) !important;
  min-width: min(84vw,360px) !important;
  max-width: min(84vw,360px) !important;
}

html.${MOBILE_CLASS} [data-employee-workspace] #aniversariantes article {
  width: min(88vw,380px) !important;
  min-width: min(88vw,380px) !important;
  max-width: min(88vw,380px) !important;
}
`;

function isMobileEmployeeDevice() {
  if (typeof window === "undefined") return false;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  return touch || viewportWidth <= 1100;
}

export function EmployeeMobileRuntimeGuard() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const employeeRoute = pathname.startsWith("/painel");

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle(MOBILE_CLASS, employeeRoute && isMobileEmployeeDevice());
    };

    apply();
    const timers = [0, 150, 500, 1200].map((delay) => window.setTimeout(apply, delay));
    window.addEventListener("resize", apply, { passive: true });
    window.addEventListener("orientationchange", apply, { passive: true });
    window.visualViewport?.addEventListener("resize", apply, { passive: true });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      root.classList.remove(MOBILE_CLASS);
    };
  }, [employeeRoute]);

  if (!employeeRoute) return null;
  return <style data-employee-mobile-runtime>{RUNTIME_CSS}</style>;
}
