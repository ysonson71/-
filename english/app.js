import { CURRICULUM } from './curriculum.js';
import { VRMViewer } from './vrm-viewer.js';
import { SpeechService } from './speech-service.js';
import { GeminiService } from './gemini-service.js';

class EnglishTutorApp {
  constructor() {
    this.curriculum = CURRICULUM;
    this.currentTopicIndex = 0;
    this.currentStage = 1; // 1: Key Expressions, 2: Roleplay
    this.currentSentenceIndex = 0;
    this.chatHistory = []; // For Stage 2 roleplay

    this.viewer = null;
    this.speech = new SpeechService();
    this.gemini = new GeminiService();

    this.initDOM();
    this.initEvents();
    this.initViewer();
  }

  get topic() {
    return this.curriculum[this.currentTopicIndex];
  }

  get currentSentence() {
    return this.topic.sentences[this.currentSentenceIndex];
  }

  initDOM() {
    this.dom = {
      canvas: document.getElementById('vrm-canvas'),
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingText: document.getElementById('loading-text'),
      
      // Header
      topicBtn: document.getElementById('topic-select-btn'),
      topicTitle: document.getElementById('topic-title'),
      stageBadge: document.getElementById('stage-badge'),
      settingsBtn: document.getElementById('settings-btn'),
      
      // Subtitles
      avatarSubtitle: document.getElementById('avatar-subtitle'),
      userSubtitle: document.getElementById('user-subtitle'),
      tipText: document.getElementById('tip-text'),
      
      // Stage 1 controls
      stage1Controls: document.getElementById('stage1-controls'),
      listenBtn: document.getElementById('listen-btn'),
      repeatMicBtn: document.getElementById('repeat-mic-btn'),
      nextSentenceBtn: document.getElementById('next-sentence-btn'),
      stepDots: document.getElementById('step-dots'),
      
      // Stage 2 controls
      stage2Controls: document.getElementById('stage2-controls'),
      roleplayMicBtn: document.getElementById('roleplay-mic-btn'),
      goalHintBtn: document.getElementById('goal-hint-btn'),
      micStatusText: document.getElementById('mic-status-text'),

      // Modals
      settingsModal: document.getElementById('settings-modal'),
      closeSettingsBtn: document.getElementById('close-settings-btn'),
      apiKeyInput: document.getElementById('gemini-api-key'),
      saveApiKeyBtn: document.getElementById('save-api-key-btn'),
      vrmFileInput: document.getElementById('vrm-file-input'),

      topicModal: document.getElementById('topic-modal'),
      closeTopicBtn: document.getElementById('close-topic-btn'),
      topicListContainer: document.getElementById('topic-list-container')
    };

    if (this.gemini.hasApiKey()) {
      this.dom.apiKeyInput.value = this.gemini.getApiKey();
    }
  }

  initEvents() {
    // Stage 1 events
    this.dom.listenBtn.addEventListener('click', () => this.speakCurrentSentence());
    this.dom.repeatMicBtn.addEventListener('click', () => this.toggleRepeatRecording());
    this.dom.nextSentenceBtn.addEventListener('click', () => this.handleNextSentenceOrStage());

    // Stage 2 events
    this.dom.roleplayMicBtn.addEventListener('click', () => this.toggleRoleplayRecording());
    this.dom.goalHintBtn.addEventListener('click', () => this.showGoalHint());

    // Topic selection
    this.dom.topicBtn.addEventListener('click', () => this.openTopicModal());
    this.dom.closeTopicBtn.addEventListener('click', () => this.closeTopicModal());

    // Settings
    this.dom.settingsBtn.addEventListener('click', () => this.openSettingsModal());
    this.dom.closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
    this.dom.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());

    // Custom VRM upload
    this.dom.vrmFileInput.addEventListener('change', (e) => this.handleCustomVRMUpload(e));
  }

  async initViewer() {
    try {
      this.dom.loadingText.textContent = 'Preparing 3D Stage...';
      this.viewer = new VRMViewer(this.dom.canvas);

      this.dom.loadingText.textContent = 'Loading 3D Anime Avatar...';
      await this.viewer.loadModel('./assets/models/default_avatar.vrm');

      this.dom.loadingOverlay.classList.add('hidden');
      this.updateUI();

      // Welcome greeting
      setTimeout(() => {
        this.speakAvatar("Hello! Welcome to our English practice. Let's start with today's expressions!");
      }, 600);
    } catch (err) {
      console.error(err);
      this.dom.loadingText.textContent = 'Loaded in 3D fallback mode. Ready!';
      setTimeout(() => {
        this.dom.loadingOverlay.classList.add('hidden');
        this.updateUI();
      }, 1000);
    }
  }

  updateUI() {
    this.dom.topicTitle.textContent = `${this.topic.emoji} ${this.topic.title}`;
    
    if (this.currentStage === 1) {
      this.dom.stageBadge.textContent = `Stage 1: Sentence ${this.currentSentenceIndex + 1}/3`;
      this.dom.stage1Controls.style.display = 'flex';
      this.dom.stage2Controls.style.display = 'none';
      this.dom.stage1Controls.classList.remove('hidden');
      this.dom.stage2Controls.classList.add('hidden');
      this.dom.tipText.textContent = `Tip: ${this.currentSentence.tip}`;

      // Update dots
      this.dom.stepDots.innerHTML = '';
      for (let i = 0; i < this.topic.sentences.length; i++) {
        const dot = document.createElement('span');
        dot.className = `dot ${i === this.currentSentenceIndex ? 'active' : (i < this.currentSentenceIndex ? 'completed' : '')}`;
        this.dom.stepDots.appendChild(dot);
      }

      this.dom.avatarSubtitle.textContent = `"${this.currentSentence.english}"`;
      this.dom.userSubtitle.textContent = 'Tap the microphone and repeat after Emma.';
    } else {
      this.dom.stageBadge.textContent = 'Stage 2: Live Roleplay';
      this.dom.stage1Controls.style.display = 'none';
      this.dom.stage2Controls.style.display = 'flex';
      this.dom.stage1Controls.classList.add('hidden');
      this.dom.stage2Controls.classList.remove('hidden');
      this.dom.tipText.textContent = `Roleplay with ${this.topic.roleplay.partnerName} (${this.topic.roleplay.partnerRole})`;
    }
  }

  speakAvatar(text, onEnd) {
    this.dom.avatarSubtitle.textContent = text;
    this.speech.speak(
      text,
      (viseme, amount) => {
        if (this.viewer) {
          this.viewer.setLipSync(viseme, amount);
        }
      },
      () => {
        if (this.viewer) {
          this.viewer.setLipSync('aa', 0);
        }
        if (onEnd) onEnd();
      }
    );
  }

  speakCurrentSentence() {
    this.speakAvatar(this.currentSentence.english);
  }

  toggleRepeatRecording() {
    if (this.speech.isListening) {
      this.speech.stopListening();
      this.dom.repeatMicBtn.classList.remove('recording');
      return;
    }

    this.dom.repeatMicBtn.classList.add('recording');
    this.dom.userSubtitle.textContent = 'Listening... Speak now!';

    this.speech.startListening({
      onInterim: (text) => {
        this.dom.userSubtitle.textContent = text;
      },
      onFinal: async (spokenText) => {
        this.dom.repeatMicBtn.classList.remove('recording');
        if (!spokenText) {
          this.dom.userSubtitle.textContent = "Didn't catch that. Tap the mic to try again!";
          return;
        }

        this.dom.userSubtitle.textContent = `You: "${spokenText}"`;
        
        // Evaluate pronunciation
        const evalResult = await this.gemini.evaluateRepetition(
          this.currentSentence.english,
          spokenText
        );

        if (this.viewer) {
          this.viewer.setExpression('happy', 0.8);
          setTimeout(() => this.viewer.setExpression('happy', 0.2), 2500);
        }

        this.speakAvatar(evalResult.feedback);
      },
      onError: (err) => {
        this.dom.repeatMicBtn.classList.remove('recording');
        this.dom.userSubtitle.textContent = `Microphone note: ${err}`;
      }
    });
  }

  handleNextSentenceOrStage() {
    if (this.currentSentenceIndex < this.topic.sentences.length - 1) {
      this.currentSentenceIndex++;
      this.updateUI();
      setTimeout(() => this.speakCurrentSentence(), 300);
    } else {
      // Transition to Stage 2: Roleplay
      this.currentStage = 2;
      this.chatHistory = [];
      this.updateUI();
      
      const greeting = this.topic.roleplay.initialMessage;
      this.chatHistory.push({ role: 'assistant', content: greeting });
      setTimeout(() => this.speakAvatar(greeting), 400);
    }
  }

  toggleRoleplayRecording() {
    if (this.speech.isListening) {
      this.speech.stopListening();
      this.dom.roleplayMicBtn.classList.remove('recording');
      this.dom.micStatusText.textContent = 'Tap to Speak';
      return;
    }

    this.dom.roleplayMicBtn.classList.add('recording');
    this.dom.micStatusText.textContent = 'Listening... Tap when done';
    this.dom.userSubtitle.textContent = 'Listening to your voice...';

    this.speech.startListening({
      onInterim: (text) => {
        this.dom.userSubtitle.textContent = `You: "${text}"`;
      },
      onFinal: async (spokenText) => {
        this.dom.roleplayMicBtn.classList.remove('recording');
        this.dom.micStatusText.textContent = 'Tap to Speak';

        if (!spokenText) {
          this.dom.userSubtitle.textContent = "Didn't hear you clearly. Please try again!";
          return;
        }

        this.dom.userSubtitle.textContent = `You: "${spokenText}"`;
        this.chatHistory.push({ role: 'user', content: spokenText });

        try {
          this.dom.avatarSubtitle.textContent = 'Thinking...';
          let aiResponse = '';

          if (this.gemini.hasApiKey()) {
            aiResponse = await this.gemini.sendChatMessage(
              this.chatHistory,
              this.topic.roleplay.systemPrompt
            );
          } else {
            // Intelligent fallback when API key is not yet set
            aiResponse = "That sounds great! By the way, remember to add your Gemini API Key in Settings to have endless custom roleplays!";
          }

          this.chatHistory.push({ role: 'assistant', content: aiResponse });
          this.speakAvatar(aiResponse);
        } catch (err) {
          console.error(err);
          this.speakAvatar("I had a little trouble connecting. Could you please check your Gemini API key in settings?");
        }
      },
      onError: (err) => {
        this.dom.roleplayMicBtn.classList.remove('recording');
        this.dom.micStatusText.textContent = 'Tap to Speak';
        this.dom.userSubtitle.textContent = `Mic status: ${err}`;
      }
    });
  }

  showGoalHint() {
    const hint = `Goal: ${this.topic.roleplay.userGoal}`;
    alert(hint);
  }

  // Modals
  openTopicModal() {
    this.dom.topicListContainer.innerHTML = '';
    this.curriculum.forEach((t, idx) => {
      const card = document.createElement('div');
      card.className = `topic-card ${idx === this.currentTopicIndex ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="topic-emoji">${t.emoji}</div>
        <div class="topic-info">
          <h4>${t.title}</h4>
          <p>${t.description}</p>
        </div>
      `;
      card.addEventListener('click', () => {
        this.currentTopicIndex = idx;
        this.currentStage = 1;
        this.currentSentenceIndex = 0;
        this.closeTopicModal();
        this.updateUI();
        this.speakCurrentSentence();
      });
      this.dom.topicListContainer.appendChild(card);
    });
    this.dom.topicModal.classList.remove('hidden');
  }

  closeTopicModal() {
    this.dom.topicModal.classList.add('hidden');
  }

  openSettingsModal() {
    this.dom.settingsModal.classList.remove('hidden');
  }

  closeSettingsModal() {
    this.dom.settingsModal.classList.add('hidden');
  }

  saveApiKey() {
    const key = this.dom.apiKeyInput.value.trim();
    this.gemini.setApiKey(key);
    alert(key ? 'Gemini API Key saved!' : 'API Key cleared.');
    this.closeSettingsModal();
  }

  async handleCustomVRMUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      this.dom.loadingOverlay.classList.remove('hidden');
      this.dom.loadingText.textContent = 'Loading custom VRM character...';
      const blobUrl = URL.createObjectURL(file);
      await this.viewer.loadModel(blobUrl);
      this.dom.loadingOverlay.classList.add('hidden');
      this.closeSettingsModal();
      this.speakAvatar("Hi! I love my new look! Let's continue speaking English together.");
    } catch (err) {
      alert('Failed to load the VRM file: ' + err.message);
      this.dom.loadingOverlay.classList.add('hidden');
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new EnglishTutorApp();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
});
