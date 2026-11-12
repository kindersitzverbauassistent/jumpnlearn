"use strict";

async function testCsvImport() {
  const saved = { appData, saveAppData, selectedName, dataWritable, status: wordStatus.textContent };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const importCsv = text => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error("Der CSV-Import wurde nicht abgeschlossen."));
    }, 5000);
    const observer = new MutationObserver(() => {
      if (wordStatus.textContent === "CSV-Datei wird geprüft …") return;
      clearTimeout(timer);
      observer.disconnect();
      resolve(wordStatus.textContent);
    });
    observer.observe(wordStatus, { childList: true, characterData: true, subtree: true });
    const files = new DataTransfer();
    files.items.add(new File([text], "test.csv", { type: "text/csv" }));
    csvFile.files = files.files;
    csvFile.dispatchEvent(new Event("change"));
  });
  try {
    appData = {
      name: "Test",
      words: [
        { id: "cat", german: "Katze", english: "cat", right: 0, wrong: 0 },
        { id: "book", german: "Buch", english: "book", right: 0, wrong: 0 }
      ],
      profiles: [{ name: "Test", stats: [{ id: "cat", right: 3, wrong: 1 }] }],
      highscores: []
    };
    selectedName = "Test";
    dataWritable = true;
    let saves = 0;
    saveAppData = next => { saves++; appData = next; return true; };
    const csv = 'Deutsch;Englisch\nKatze; CAT \nHund;dog\nanderer Hund;DOG\n"rot; gelb";colour\n';
    const status = await importCsv(csv);
    check(status === "2 Vokabeln importiert; 2 Duplikate übersprungen." && saves === 1,
      "Neue Vokabeln müssen importiert und vorhandene sowie interne Duplikate gezählt werden.");
    check(appData.words.length === 4 && appData.words[0].german === "Katze" &&
      appData.words[2].english === "dog" && appData.words[3].german === "rot; gelb" &&
      appData.profiles[0].stats[0].right === 3 && appData.profiles[0].stats[0].wrong === 1,
      "Bestehende Vokabeln und Statistiken müssen erhalten bleiben.");

    const before = appData;
    const duplicateStatus = await importCsv(csv);
    check(duplicateStatus === "0 Vokabeln importiert; 4 Duplikate übersprungen." &&
      saves === 1 && appData === before, "Ein Import nur mit Duplikaten darf nichts speichern.");

    const errorStatus = await importCsv("Deutsch;Englisch\nMaus;mouse\n;cat\n");
    check(errorStatus.includes("Zeile 3") && errorStatus.includes("Keine Vokabeln wurden importiert.") &&
      saves === 1 && appData === before, "Fehlerhafte Zeilen müssen weiterhin den gesamten Import verhindern.");
    return "CSV-Import und Duplikate: alle Tests bestanden";
  } finally {
    appData = saved.appData;
    saveAppData = saved.saveAppData;
    selectedName = saved.selectedName;
    dataWritable = saved.dataWritable;
    wordStatus.textContent = saved.status;
    renderMenu();
  }
}
