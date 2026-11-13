/* Deckbuilder Upload v3 - static controls, no WebSocket required. */
(() => {
  'use strict';
  const picker = document.getElementById('deckUploadFiles');
  const label = document.getElementById('deckUploadLabel');
  const originalRender = renderBuilder;
  renderBuilder = function () {
    originalRender();
    label.textContent = builderStage === 'heroes' ? 'Charakterkarten hochladen' : 'Effektkarten hochladen';
    const hint = document.querySelector('#builderGrid > .hint');
    if (hint) hint.textContent = 'Noch keine Karten gespeichert. Lade hier neue Karten hoch.';
  };
  picker.addEventListener('change', async () => {
    const files = Array.from(picker.files || []);
    if (files.length > 30) { toast('Maximal 30 Bilder auf einmal'); picker.value = ''; return; }
    const type = builderStage === 'heroes' ? 'hero' : 'action';
    picker.disabled = true;
    let saved = 0, skipped = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const suggestion = file.name.replace(/\.[^.]+$/, '').trim() || 'Neue Karte';
        const inputName = prompt(`Karte ${i + 1}/${files.length}: Name`, suggestion);
        if (inputName === null) { skipped++; continue; }
        const name = inputName.trim();
        if (!name || name.length > 80) { toast('Name muss 1 bis 80 Zeichen haben'); skipped++; continue; }
        let attack = 0, hp = 1;
        if (type === 'hero') {
          const a = prompt(`${name} – Angriff (0 bis 99)`, '5');
          if (a === null) { skipped++; continue; }
          const h = prompt(`${name} – maximale Lebenspunkte (1 bis 99)`, '15');
          if (h === null) { skipped++; continue; }
          if (!/^\d+$/.test(a.trim()) || !/^\d+$/.test(h.trim())) { toast('Bitte ganze Zahlen eingeben'); skipped++; continue; }
          attack = Number(a); hp = Number(h);
          if (attack > 99 || hp < 1 || hp > 99) { toast('Ungültige Werte für ' + name); skipped++; continue; }
        }
        try {
          toast(`Speichere ${name} …`);
          const image = await compressCard(file);
          await dbRequest('cards', 'readwrite', store => store.add({name, image, type, attack, hp}));
          saved++;
        } catch (err) {
          toast(`${name}: ${err.message || 'Fehler beim Speichern'}`);
          skipped++;
        }
      }
      builderCards = await getSaved();
      renderBuilder();
      toast(`${saved} Karte(n) gespeichert${skipped ? `, ${skipped} übersprungen` : ''}`);
    } catch (err) { toast('Upload fehlgeschlagen: ' + err.message); }
    finally { picker.value = ''; picker.disabled = false; }
  });
})();
