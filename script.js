document.addEventListener('DOMContentLoaded', () => {

  // ── Elements ───────────────────────────────────────────────────────────
  const tabs         = document.querySelectorAll('.tab-btn');
  const uploadArea   = document.getElementById('upload-area');
  const fileInput    = document.getElementById('file-input');
  const fileTypeHint = document.getElementById('file-type-hint');
  const loadingState = document.getElementById('loading-state');
  const resultState  = document.getElementById('result-state');
  const qrContainer  = document.getElementById('qrcode-container');
  const progressBar  = document.getElementById('progressBar');
  const progressText = document.getElementById('progress-text');
  const btnDownload  = document.getElementById('btn-download');
  const btnCopy      = document.getElementById('btn-copy');
  const btnWhatsapp  = document.getElementById('btn-whatsapp');
  const btnNew       = document.getElementById('btn-new');
  const navToggle    = document.getElementById('navToggle');
  const mobileMenu   = document.getElementById('mobileMenu');
  const toast        = document.getElementById('toast');

  // Music upload elements
  const musicSection  = document.getElementById('music-upload-section');
  const musicDropArea = document.getElementById('music-drop-area');
  const musicInput    = document.getElementById('music-input');
  const musicSelected = document.getElementById('music-selected');
  const musicFilename = document.getElementById('music-filename');
  const musicRemoveBtn= document.getElementById('music-remove-btn');
  const btnGenerateQR = document.getElementById('btn-generate-qr');
  const btnSkipMusic  = document.getElementById('btn-skip-music');

  let currentType      = 'image';
  let generatedViewUrl = '';
  let uploadedMediaUrl = '';   // holds the image/video/audio URL after first upload
  let uploadedMusicUrl = '';   // holds the background music URL (optional)

  const hints = {
    image: 'JPG, PNG, GIF, WebP — max 10 MB',
    video: 'MP4, WebM, MOV — max 50 MB',
    audio: 'MP3, WAV, OGG, M4A — max 20 MB'
  };
  const accepts = {
    image: 'image/*',
    video: 'video/*',
    audio: 'audio/*'
  };
  const progressMessages = {
    image: ['Uploading your photo…', 'Storing securely…', 'Wrapping your gift…'],
    video: ['Uploading your video…', 'Processing…', 'Almost ready…'],
    audio: ['Uploading your audio…', 'Encoding…', 'Creating the surprise…']
  };
  const maxSizes = { image: 10, video: 50, audio: 20 };

  // ── Ping server on page load (wakes Render free tier) ──────────────────
  fetch('/health').catch(() => {});

  // ── Nav toggle ──────────────────────────────────────────────────────────
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    mobileMenu.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => mobileMenu.classList.remove('open'))
    );
  }

  // ── Toast ───────────────────────────────────────────────────────────────
  function showToast(msg, duration = 4000) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ── Steps ───────────────────────────────────────────────────────────────
  function setStep(n) {
    document.querySelectorAll('.step').forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 <  n) s.classList.add('done');
      if (i + 1 === n) s.classList.add('active');
    });
  }

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentType              = tab.dataset.type;
      fileTypeHint.textContent = hints[currentType];
      fileInput.accept         = accepts[currentType];
    });
  });

  // ── Drag & Drop / Click ─────────────────────────────────────────────────
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFileUpload(e.target.files[0]);
  });

  // ── Upload ──────────────────────────────────────────────────────────────
  async function handleFileUpload(file) {

    // Auto-detect type from actual file mime
    const autoType = file.type.startsWith('video/') ? 'video'
                   : file.type.startsWith('audio/') ? 'audio'
                   : 'image';
    if (autoType !== currentType) {
      currentType = autoType;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.type === currentType));
    }

    // Size check
    const maxMB = maxSizes[currentType];
    if (file.size > maxMB * 1024 * 1024) {
      showToast(`⚠️ File too large. Max ${maxMB} MB for ${currentType}.`);
      return;
    }

    // Show loading
    uploadArea.classList.add('hidden');
    document.querySelector('.tabs').classList.add('hidden');
    loadingState.classList.remove('hidden');
    resultState.classList.add('hidden');
    progressBar.style.width  = '0%';
    setStep(2);

    // Progress animation
    const msgs = progressMessages[currentType];
    let prog = 0, msgIdx = 0;
    progressText.textContent = msgs[0];

    const interval = setInterval(() => {
      prog += Math.random() * 10 + 2;
      if (prog > 85) prog = 85;
      progressBar.style.width = prog + '%';
      const nIdx = Math.min(Math.floor((prog / 85) * msgs.length), msgs.length - 1);
      if (nIdx !== msgIdx) {
        msgIdx = nIdx;
        progressText.textContent = msgs[msgIdx];
      }
    }, 700);

    // Build form data
    const formData = new FormData();
    formData.append('media', file);

    // Abort controller — 3 min timeout for large videos
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body:   formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearInterval(interval);
      progressBar.style.width = '100%';

      // ── Parse response safely ──────────────────────────────────────────
      let data;
      const ct = response.headers.get('content-type') || '';

      if (ct.includes('application/json')) {
        data = await response.json();
      } else {
        // Server returned HTML — most likely Render cold-start splash or crash
        const html = await response.text();
        console.error('Non-JSON response from server:', html.slice(0, 300));

        if (!response.ok) {
          // Retry once after 3 seconds (server was waking up)
          showToast('⏳ Server waking up… retrying in 3 seconds.', 3000);
          await sleep(3000);
          return handleFileUpload(file); // retry
        }

        throw new Error('Server returned unexpected HTML response.');
      }

      if (response.ok && data.success) {
        uploadedMediaUrl = data.url;
        progressBar.style.width = '100%';

        setTimeout(() => {
          loadingState.classList.add('hidden');

          // For image uploads, show optional music section first
          if (currentType === 'image') {
            uploadArea.classList.add('hidden');
            document.querySelector('.tabs').classList.add('hidden');
            musicSection.classList.remove('hidden');
            setStep(2);
          } else {
            // For video/audio tabs, go straight to QR (no background music needed)
            generatedViewUrl = buildViewUrl(data.url, null);
            showResult(generatedViewUrl);
          }
        }, 400);
      } else {
        showToast('❌ ' + (data.message || 'Upload failed. Please try again.'), 5000);
        resetUI();
      }

    } catch (err) {
      clearTimeout(timeoutId);
      clearInterval(interval);
      console.error('[Upload error]', err);

      let msg = '❌ Upload failed. Please try again.';
      if (err.name === 'AbortError') {
        msg = '⏱️ Upload timed out. Try a smaller file.';
      } else if (!navigator.onLine) {
        msg = '📵 No internet connection detected.';
      }
      showToast(msg, 5000);
      resetUI();
    }
  }

  // ── Sleep helper ────────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Build view URL (with optional music param) ──────────────────────────
  function buildViewUrl(mediaUrl, musicUrl) {
    let url = `${window.location.origin}/view.html`
      + `?type=${encodeURIComponent(currentType)}`
      + `&file=${encodeURIComponent(mediaUrl)}`;
    if (musicUrl) {
      url += `&music=${encodeURIComponent(musicUrl)}`;
    }
    return url;
  }

  // ── Music section: tap drop area ────────────────────────────────────────
  if (musicDropArea) {
    musicDropArea.addEventListener('click', () => musicInput.click());
    musicInput.addEventListener('change', e => {
      if (e.target.files.length) selectMusicFile(e.target.files[0]);
    });
  }

  function selectMusicFile(file) {
    if (!file.type.includes('audio') && !file.name.toLowerCase().endsWith('.mp3')) {
      showToast('⚠️ Please select an MP3 file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('⚠️ Music file too large. Max 10 MB.');
      return;
    }
    uploadedMusicUrl = '';
    musicDropArea.classList.add('hidden');
    musicFilename.textContent = file.name;
    musicSelected.classList.remove('hidden');
    // Store file reference for later upload
    musicInput._selectedFile = file;
  }

  if (musicRemoveBtn) {
    musicRemoveBtn.addEventListener('click', () => {
      uploadedMusicUrl = '';
      musicInput.value = '';
      musicInput._selectedFile = null;
      musicSelected.classList.add('hidden');
      musicDropArea.classList.remove('hidden');
    });
  }

  // ── Generate QR with optional music ────────────────────────────────────
  if (btnGenerateQR) {
    btnGenerateQR.addEventListener('click', async () => {
      const file = musicInput._selectedFile;

      if (file) {
        // Upload MP3 first, then generate QR
        btnGenerateQR.disabled = true;
        btnGenerateQR.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading music…';

        try {
          const formData = new FormData();
          formData.append('music', file);

          const response = await fetch('/upload-audio', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();

          if (response.ok && data.success) {
            uploadedMusicUrl = data.url;
          } else {
            showToast('⚠️ Music upload failed. Generating QR without music.');
            uploadedMusicUrl = '';
          }
        } catch (err) {
          console.error('[Music upload error]', err);
          showToast('⚠️ Music upload failed. Generating QR without music.');
          uploadedMusicUrl = '';
        }

        btnGenerateQR.disabled = false;
        btnGenerateQR.innerHTML = '<i class="fa-solid fa-qrcode"></i> Generate QR Code';
      }

      generatedViewUrl = buildViewUrl(uploadedMediaUrl, uploadedMusicUrl || null);
      musicSection.classList.add('hidden');
      showResult(generatedViewUrl);
    });
  }

  // ── Skip music — generate QR right away ────────────────────────────────
  if (btnSkipMusic) {
    btnSkipMusic.addEventListener('click', () => {
      uploadedMusicUrl = '';
      generatedViewUrl = buildViewUrl(uploadedMediaUrl, null);
      musicSection.classList.add('hidden');
      showResult(generatedViewUrl);
    });
  }

  // ── Show QR result ──────────────────────────────────────────────────────
  function showResult(url) {
    qrContainer.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text:         url,
        width:        200,
        height:       200,
        colorDark:    '#1A0E2C',
        colorLight:   '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      // Fallback if QRCode library failed to load
      qrContainer.innerHTML = `
        <div style="padding:16px;text-align:center">
          <p style="font-size:.85rem;color:#7B6E91;margin-bottom:10px">QR library not loaded.<br>Use the link below:</p>
          <a href="${url}" target="_blank"
             style="color:#6C48C4;font-weight:600;font-size:.8rem;word-break:break-all">${url}</a>
        </div>`;
    }

    resultState.classList.remove('hidden');
    setStep(3);
    resultState.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Download QR ─────────────────────────────────────────────────────────
  btnDownload.addEventListener('click', () => {
    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) {
      if (generatedViewUrl) window.open(generatedViewUrl, '_blank');
      return;
    }
    const out = document.createElement('canvas');
    const pad = 24, lblH = 36;
    out.width  = canvas.width  + pad * 2;
    out.height = canvas.height + pad * 2 + lblH;
    const ctx  = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, pad, pad);
    ctx.fillStyle = '#6C48C4';
    ctx.font      = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GiftQR Studio', out.width / 2, out.height - 10);
    const a      = document.createElement('a');
    a.href       = out.toDataURL('image/png');
    a.download   = `GiftQR-${Date.now()}.png`;
    a.click();
    showToast('✅ QR image downloaded!');
  });

  // ── Copy link ───────────────────────────────────────────────────────────
  btnCopy.addEventListener('click', () => {
    if (!generatedViewUrl) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(generatedViewUrl)
        .then(() => {
          const orig = btnCopy.innerHTML;
          btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          showToast('🔗 Link copied!');
          setTimeout(() => btnCopy.innerHTML = orig, 2200);
        })
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  });

  function fallbackCopy() {
    const el = document.createElement('textarea');
    el.value = generatedViewUrl;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
    document.body.appendChild(el);
    el.focus(); el.select();
    el.setSelectionRange(0, 99999);
    try {
      document.execCommand('copy');
      showToast('🔗 Link copied!');
    } catch {
      showToast('Could not auto-copy. Please copy the link manually.');
    }
    document.body.removeChild(el);
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────
  btnWhatsapp.addEventListener('click', () => {
    const text = encodeURIComponent(
      `🎁 I have a surprise gift for you!\nTap to reveal: ${generatedViewUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  });

  // ── Create another ──────────────────────────────────────────────────────
  btnNew.addEventListener('click', resetUI);

  // ── Reset UI ────────────────────────────────────────────────────────────
  function resetUI() {
    loadingState.classList.add('hidden');
    resultState.classList.add('hidden');
    musicSection.classList.add('hidden');
    uploadArea.classList.remove('hidden');
    document.querySelector('.tabs').classList.remove('hidden');
    progressBar.style.width  = '0%';
    progressText.textContent = '';
    qrContainer.innerHTML    = '';
    generatedViewUrl         = '';
    uploadedMediaUrl         = '';
    uploadedMusicUrl         = '';
    fileInput.value          = '';
    if (musicInput) {
      musicInput.value = '';
      musicInput._selectedFile = null;
    }
    if (musicSelected) musicSelected.classList.add('hidden');
    if (musicDropArea) musicDropArea.classList.remove('hidden');
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Scroll-reveal ───────────────────────────────────────────────────────
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity   = '1';
        e.target.style.transform = 'translateY(0)';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.how-step, .use-card').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(24px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    observer.observe(el);
  });

});
