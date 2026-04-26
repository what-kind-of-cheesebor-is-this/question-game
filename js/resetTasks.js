import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

const tasks = [
  "Назвать любое трёхзначное число",
  "Назвать дальнюю родственную связь (не дети, не родители, не сиблинги)",
  "Использовать англицизм (заимствованное слово)",
  "Попросить прощения",
  "Назвать кого-нибудь полным ФИО",
  "Ругнуться",
  "Упомянуть бога",
  "Назвать страну (не ту, в которой вы находитесь)",
  "Использовать аббревиатуру",
  "Сказать название иностранной песни",
  "Сказать “Я не знаю”",
  "Пожелать удачи",
  "Поблагодарить",
  "Назвать дикое животное (не собака, не кошка)",
  "Дать обещание",
  "Сказать слово “Никогда”",
  "Сказать слово “Всегда”",
  "Сказать, что у кого-то из игроков что-то “красивое” (или кто-то из игроков красивый)",
  "Сказать игроку комплимент (не про красоту)",
  "Похвастаться",
  "Попросить помощи",
  "Рассказать анекдот",
  "Дать совет",
  "Сказать слово “Смерть”"
];

async function resetTaskTemplates() {
  const ref = collection(db, "taskTemplates");

  const snapshot = await getDocs(ref);

  await Promise.all(snapshot.docs.map((taskDoc) => deleteDoc(taskDoc.ref)));

  await Promise.all(
    tasks.map((text, index) =>
      setDoc(doc(db, "taskTemplates", `task-${index + 1}`), {
        text
      })
    )
  );

  console.log("Task templates reset successfully");
}

resetTaskTemplates();

