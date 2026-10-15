import canhBaoMp3 from "../assets/canh_bao.mp3";

// Am thanh canh bao khi vi pham FIFO - phat file canh_bao.mp3.
// Neu vi ly do nao do file khong phat duoc (bi chan autoplay, loi decode...),
// fallback ve tieng "bip bip" tong hop bang Web Audio API de van co canh bao.
let sharedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio(canhBaoMp3);
  }
  return sharedAudio;
}

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  if (sharedContext.state === "suspended") {
    sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

const BEEP_ON_MS = 260;
const BEEP_OFF_MS = 160;
const TOTAL_DURATION_MS = 5000;
const BEEP_FREQUENCY_HZ = 880;

// Thoi diem (theo ctx.currentTime) ma chuoi bip tong hop dang phat se ket thuc - dung de tranh
// lich chong 1 chuoi bip MOI de len tren chuoi dang chay (moi oscillator la 1 nguon am doc lap,
// khong giong <audio> nen se thuc su vang chong len nhau chu khong tu dong tua/thay the).
let synthesizedBeepBusyUntil = 0;

function playSynthesizedBeep() {
  try {
    const ctx = getContext();
    if (ctx.currentTime < synthesizedBeepBusyUntil) {
      return;
    }
    const cycleMs = BEEP_ON_MS + BEEP_OFF_MS;
    const beepCount = Math.ceil(TOTAL_DURATION_MS / cycleMs);
    synthesizedBeepBusyUntil = ctx.currentTime + TOTAL_DURATION_MS / 1000;

    for (let i = 0; i < beepCount; i++) {
      const startAt = ctx.currentTime + (i * cycleMs) / 1000;
      const stopAt = startAt + BEEP_ON_MS / 1000;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(BEEP_FREQUENCY_HZ, startAt);

      // Envelope ngan de tranh tieng "tach" khi bat/tat dot ngot.
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.25, startAt + 0.015);
      gain.gain.setValueAtTime(0.25, stopAt - 0.02);
      gain.gain.linearRampToValueAtTime(0, stopAt);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(stopAt);
    }
  } catch {
    // Trinh duyet chua cho phep phat am thanh (chua co tuong tac nguoi dung) - bo qua trong im lang.
  }
}

export function playFifoAlarmSound() {
  try {
    const audio = getAudio();
    // Neu doan canh bao truoc VAN DANG PHAT DO (vd 2 lan vi pham that xay ra sat nhau, gan hon do
    // dai file canh_bao.mp3), KHONG tua ve dau (currentTime = 0) de phat de - lam vay se chong len
    // phan con lai cua lan phat truoc, tao cam giac "vang/lap" 2 tieng cung 1 doan nhac. Thay vao do
    // de doan dang phat chay het, chi phat lai tu dau khi no da thuc su dung (paused/ended).
    if (!audio.paused && !audio.ended) {
      return;
    }
    audio.currentTime = 0;
    audio.play().catch(() => {
      playSynthesizedBeep();
    });
  } catch {
    playSynthesizedBeep();
  }
}

// Trinh duyet chan phat am thanh cho den khi nguoi dung tuong tac (bam/go phim) voi trang trong lan tai nay -
// tai lai trang (F5) roi de nguyen man hinh kho thi canh bao FIFO se im lang. Dung de hien banner nhac bam
// vao trang 1 lan (xem AlarmSoundBanner).
let manuallyUnlocked = false;

export function isAlarmSoundUnlocked(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? activation.hasBeenActive : manuallyUnlocked;
}

// Goi trong 1 su kien nguoi dung (click/keydown): phat im lang file am thanh va danh thuc AudioContext de cac lan
// canh bao sau phat duoc ngay ca khi khong con thao tac nao.
export function unlockAlarmSound() {
  manuallyUnlocked = true;
  try {
    const audio = getAudio();
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
    getContext();
  } catch {
    // Khong mo khoa duoc cung khong sao - canh bao that van thu phat va tu fallback.
  }
}
