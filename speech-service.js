// Web Speech API Service (TTS & STT with Lip-sync driving)

export class SpeechService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.lipSyncTimer = null;

    this.initVoices();
    this.initRecognition();
  }

  initVoices() {
    const loadVoices = () => {
      this.voices = this.synth.getVoices();
      // Prefer friendly female English voices
      const preferred = this.voices.find(v => 
        (v.lang === 'en-US' || v.lang.startsWith('en')) &&
        (v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Jenny') || v.name.includes('Zira') || v.name.includes('Natural') || v.name.includes('Female'))
      ) || this.voices.find(v => v.lang === 'en-US') || this.voices.find(v => v.lang.startsWith('en'));

      this.selectedVoice = preferred || this.voices[0] || null;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;
  }

  speak(text, onLipSync, onEnd) {
    if (!this.synth) return;

    this.stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = 'en-US';
    utterance.rate = 0.95; // Slightly slower for clear English practice
    utterance.pitch = 1.05; // Friendly tone

    this.isSpeaking = true;

    // Simulate realistic syllable/viseme cadence
    let step = 0;
    const visemes = ['aa', 'ih', 'ou', 'ee', 'oh'];
    this.lipSyncTimer = setInterval(() => {
      if (!this.isSpeaking) return;
      step++;
      // Natural speech rhythm: mouth opening & closing with random vowel shapes
      const isOpen = Math.sin(step * 0.8) > -0.2;
      const amount = isOpen ? 0.4 + Math.random() * 0.5 : 0.05;
      const shape = visemes[Math.floor(Math.random() * visemes.length)];
      if (onLipSync) onLipSync(shape, amount);
    }, 90);

    utterance.onend = () => {
      this.isSpeaking = false;
      clearInterval(this.lipSyncTimer);
      if (onLipSync) onLipSync('aa', 0); // close mouth
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      clearInterval(this.lipSyncTimer);
      if (onLipSync) onLipSync('aa', 0);
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    this.isSpeaking = false;
    if (this.lipSyncTimer) clearInterval(this.lipSyncTimer);
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  startListening(callbacks = {}) {
    if (!this.recognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    this.stopSpeaking();

    let finalTranscript = '';

    this.recognition.onstart = () => {
      this.isListening = true;
      callbacks.onStart?.();
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      callbacks.onInterim?.(finalTranscript || interim);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      callbacks.onError?.(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onFinal?.(finalTranscript.trim());
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Recognition already started or busy', e);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}
