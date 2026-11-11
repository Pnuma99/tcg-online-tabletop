/* TCG Deckbuilder card upload extension — load AFTER /app.js */
(() => {
  'use strict';
  const originalRenderBuilder = renderBuilder;
  const originalImportFiles = importFiles;

  // Reuse the existing image compression and IndexedDB card library.
  async function importToLibrary(event, type) {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (files.length > 30) {
      toast('Bitte maximal 30 Bilder gleichzeitig auswählen.');
      input.value = '';
      return;
    }
    input.disabled = true;
    let saved = 0, failed = 0, skipped = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const suggestedName = file.name.replace(/\.[^.]+$/, '').trim() || 'Neue Karte';
        const enteredName = prompt(`Karte ${i + 1} von ${files.length}: Kartenname`, suggestedName);
        if (enteredName === null) { skipped++; continue; }
        const name = enteredName.trim();
        if (!name || name.length > 80) {
          toast('Der Kartenname muss 1 bis 80 Zeichen enthalten.');
          failed++;
          continue;
        }
        let attack = 0, hp = 1;
        if (type === 'hero') {
          const attackText = prompt(`${name} — Angriff (0–99)`, '5');
          if (attackText === null) { skipped++; continue; }
          const hpText = prompt(`${name} — maximale Lebenspunkte (1–99)`, '15');
          if (hpText === null) { skipped++; continue; }
          if (!/^\d+$/.test(attackText.trim()) || !/^\d+$/.test(hpText.trim())) {
            toast(`${name}: Bitte ganze Zahlen eingeben.`);
            failed++;
            continue;
          }
          attack = Number(attackText);
          hp = Number(hpText);
          if (attack < 0 || attack > 99 || hp < 1 || hp > 99) {
            toast(`${name}: Angriff 0–99, Lebenspunkte 1–99.`);
            failed++;
            continue;
          }
        }
        try {
          toast(`${name} wird gespeichert (${i + 1}/${files.length}) …`);
          const image = await compressCard(file);
          // Store directly in IndexedDB; no battle lobby or WebSocket needed.
          await dbRequest('cards', 'readwrite', store => store.add({name, image, type, attack, hp}));
          saved++;
        } catch (error) {
          failed++;
          toast(`${name}: ${error.message || 'Speichern fehlgeschlagen'}`);
        }
      }
      if (builderDeck && !$('deckEditor').hidden) {
        builderCards = await getSaved();
        renderBuilder();
      }
      toast(`${saved} Karte(n) gespeichert${failed ? `, ${failed} fehlgeschlagen` : ''}${skipped ? `, ${skipped} übersprungen` : ''}.`);
    } catch (error) {
      toast(`Importfehler: ${error.message}`);
    } finally {
      input.disabled = false;
      input.value = '';
    }
  }

  renderBuilder = function () {
    originalRenderBuilder();
    const editor = $('deckEditor');
    const grid = $('builderGrid');
    if (!editor || !grid) return;
    const old = editor.querySelector('#deckbuilderUploadRow');
    if (old) old.remove();
    const hero = builderStage === 'heroes';
    const row = document.createElement('div');
    row.id = 'deckbuilderUploadRow';
    row.className = 'actions-row';
    const label = document.createElement('label');
    label.className = 'upload-btn';
    label.style.cssText = 'cursor:pointer;padding:10px 14px;border:1px solid #bda578;border-radius:8px;font-weight:700;';
    label.append(document.createTextNode(hero ? '＋ Charakterkarten hochladen' : '＋ Effektkarten hochladen'));
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.multiple = true;
    input.hidden = true;
    input.addEventListener('change', event => importToLibrary(event, hero ? 'hero' : 'action'));
    label.append(input);
    row.append(label);
    const info = document.createElement('p');
    info.className = 'hint';
    info.textContent = 'Mehrere Bilder möglich. Jede Karte erhält einen eigenen Namen' + (hero ? ', Angriff und Lebenspunkte.' : '.');
    row.append(info);
    grid.parentNode.insertBefore(row, grid);
    const empty = grid.querySelector('.hint');
    if (empty && !builderCards.some(card => card.type === (hero ? 'hero' : 'action'))) {
      empty.textContent = 'Noch keine Karten vorhanden. Lade sie direkt hier hoch.';
    }
  };
})();
