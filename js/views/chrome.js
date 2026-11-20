// chrome.js — thanh điều hướng dưới cùng: Hôm nay · nút máy ảnh hình hoa hướng dương · Hành trình.
import { html, raw } from "../ui.js";
import { icon } from "../art.js";

export function tabBar(tab) {
  return html`<nav class="tabbar" aria-label="Điều hướng chính">
    <button class="tab tab--today" data-act="tab:today" aria-current="${tab === "today" ? "page" : "false"}"><span class="tab__pill">${raw(icon("tab-today"))}</span>Hôm nay</button>
    <button class="cam" data-act="camera" aria-label="Chụp món ăn">
      <span class="cam__btn">
        <svg class="cam__bloom" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="cam__ring" cx="50" cy="50" r="50"/>
          <use class="cam__petals" href="#cam-petals"/>
          <circle class="cam__disc" cx="50" cy="50" r="36"/>
        </svg>
        ${raw(icon("camera", "cam__icon"))}
      </span>
      Chụp món
    </button>
    <button class="tab tab--journey" data-act="tab:journey" aria-current="${tab === "journey" ? "page" : "false"}"><span class="tab__pill">${raw(icon("tab-journey"))}</span>Hành trình</button>
  </nav>`;
}
