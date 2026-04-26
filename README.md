# Question Game

Многопользовательская игра-викторина, построенная на HTML/CSS/JavaScript и Firebase Firestore. Игроки получают задания, которые нужно выполнить, взаимодействуя с другими участниками.

## 📋 Содержание

- [Технологии](#технологии)
- [Структура проекта](#структура-проекта)
- [Архитектура](#архитектура)
- [Модель данных Firestore](#модель-данных-firestore)
- [Поток работы приложения](#поток-работы-приложения)
- [Установка и запуск](#установка-и-запуск)
- [API документация](#api-документация)
- [Важные концепции](#важные-концепции)
- [Отладка](#отладка)

## 🛠 Технологии

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- **Backend**: Firebase Firestore (NoSQL база данных)
- **Real-time**: Firebase Firestore real-time listeners
- **Хостинг**: Firebase Hosting (опционально)

## 📁 Структура проекта

```
question-game/
├── index.html                 # Главная страница (выбор: создать/присоединиться)
├── creater_screen.html        # Экран создания комнаты
├── connection_screen.html     # Экран подключения к комнате
├── lobby.html                 # Лобби (ожидание игроков)
├── game.html                  # Игровой экран + модалка подтверждения задания
├── js/
│   ├── main.js               # Точка входа (импортирует модули)
│   ├── firebase.js           # Инициализация Firebase
│   ├── rooms.js              # Управление комнатами и пользователями
│   ├── subscriptions.js       # Real-time подписки Firestore
│   ├── navigation.js          # Навигация и обработчики событий UI
│   ├── taskTemplates.js      # Работа с шаблонами заданий
│   └── taskAssignment.js     # Логика распределения заданий
├── Styles/
│   ├── index.css             # Стили главной страницы
│   ├── creater_screen.css    # Стили экрана создания
│   ├── connection_screen.css # Стили экрана подключения
│   ├── lobby.css             # Стили лобби
│   └── game.css              # Стили игрового экрана и confirmation modal
└── README.md                 # Документация
```

## 🏗 Архитектура

### Модули JavaScript

#### `firebase.js`
Инициализирует Firebase и экспортирует экземпляр Firestore для использования в других модулях.

**Экспорты:**
- `db` - экземпляр Firestore

#### `rooms.js`
Управление комнатами, пользователями и активным раундом.

**Функции:**
- `createRoom()` - создает новую комнату с уникальным кодом
- `joinRoom(roomId, userName, role)` - добавляет пользователя в комнату
- `findRoomByCode(code)` - находит комнату по коду
- `updateUserReady(roomId, userId, ready)` - обновляет статус готовности пользователя
- `updateRoomStatus(roomId, status, roundId?)` - обновляет статус комнаты и активный `roundId`

#### `subscriptions.js`
Real-time подписки на изменения в Firestore.

**Функции:**
- `subscribeToRoom(roomId, onRoomUpdate)` - подписка на изменения комнаты
- `subscribeToRoomUsers(roomId, onUsersUpdate)` - подписка на список пользователей комнаты

#### `taskTemplates.js`
Работа с шаблонами заданий из Firestore.

**Функции:**
- `getAllTaskTemplates()` - загружает все шаблоны заданий
- `validateTaskTemplate(template)` - валидирует структуру шаблона
- `isValidTaskIdFormat(taskId)` - проверяет формат taskId

#### `taskAssignment.js`
Логика распределения заданий между игроками.

**Функции:**
- `assignTasksToRoom(roomId)` - распределяет задания всем пользователям комнаты
- `tasksAlreadyAssigned(roomId)` - проверяет, назначены ли уже задания

**Алгоритм распределения:**
1. Загружает все шаблоны заданий
2. Перемешивает их случайным образом
3. Для каждого пользователя выбирает 3 уникальных задания
4. Для каждого задания выбирает целевого игрока (не самого пользователя)
5. Балансирует распределение целей между игроками

#### `navigation.js`
Обработка навигации и событий UI на всех страницах.

**Обрабатываемые события:**
- Создание комнаты
- Подключение к комнате
- Переключение готовности
- Запуск игры
- Отображение заданий
- Подтверждение выполнения задания (`completedAt`)
- Confirmation popup для eligible игроков
- Таймер голосования (**60 сек**) + auto-abstain
- Одноразовая резолюция результата подтверждения и обновление статусов заданий

## 💾 Модель данных Firestore

### Коллекция: `taskTemplates`

Шаблоны заданий (что делать, без указания конкретного игрока).

**Структура документа:**
```javascript
{
  text: string  // Текст задания (например, "Заставь другого человека назвать овощ")
}
```

**ID документа:** `task-1`, `task-2`, `task-3`, и т.д.

**Важные принципы:**
- Текст задания должен использовать общие термины (`другого человека`, `кого-то`, `человека`)
- Текст НЕ должен ссылаться на конкретных игроков по имени
- Целевые игроки назначаются динамически при распределении заданий

**Примеры валидных текстов:**
- ✅ "Заставь другого человека назвать овощ"
- ✅ "Убедить человека согласиться с тобой"
- ✅ "Заставить кого-то произнести определенное слово"

**Примеры невалидных текстов:**
- ❌ "Заставь Ивана назвать овощ" (ссылка на конкретного игрока)
- ❌ "Убедить игрока 1 согласиться" (ссылка на конкретного игрока)

### Коллекция: `rooms`

Комнаты для игры.

**Структура документа:**
```javascript
{
  status: "waiting" | "active",  // Статус комнаты
  code: string,                   // 4-символьный код комнаты (A-Z, 0-9)
  createdAt: timestamp,          // Время создания
  roundId: string,               // Активный раунд (например, "round-1718123123")
  roundStartedAt: timestamp,     // Время старта раунда
  assignedTasks: string[]         // Массив taskId назначенных заданий (опционально)
}
```

### Подколлекция: `rooms/{roomId}/users`

Пользователи в комнате.

**Структура документа:**
```javascript
{
  name: string,                    // Имя пользователя
  role: "host" | "player",        // Роль (хост или игрок)
  ready: boolean,                  // Статус готовности
  joinedAt: timestamp,            // Время присоединения
  tasks: [                         // Массив назначенных заданий
    {
      taskId: string,              // ID задания из Firestore (например, "task-17")
      taskText: string,            // Текст задания
      targetUserId: string,         // ID целевого игрока
      targetName: string,          // Имя целевого игрока
      assignmentId?: string,       // ID документа в подколлекции assignments (опц.)
      status: string,              // "awaiting_confirmation" | "completed" | "failed" | "discarded" (опц.)
      completedAt: timestamp,      // Время подтверждения провокатором (опц.)
      confirmationStartedAt: timestamp, // Старт окна голосования (опц.)
      confirmationResult: "accepted" | "rejected" | "discarded", // Итог (опц.)
      confirmationResolvedAt: timestamp, // Когда итог зафиксирован (опц.)
      removedAt: timestamp         // Когда задача удалена из раунда (опц.)
    }
  ]
}
```

**Важно:** Каждый пользователь получает ровно 3 задания.

### Подколлекция: `rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}`

Основной источник истины для **фазы подтверждения** по конкретному заданию игрока.

**Структура документа:**
```javascript
{
  taskId: string,                    // Firestore taskId (task-<number>)
  roundId: string,
  provocateurId: string,             // Кто выполнял задание
  targetId: string,                  // Цель задания (может совпадать с другим игроком)
  completedByUserId: string,         // UID игрока, нажавшего "Да" (совпадает с provocateurId)
  status: "awaiting_confirmation" | "completed" | "failed" | "discarded",
  createdAt?: timestamp,             // время создания записи (используется для подсчёта времени)
  completedAt: timestamp,
  confirmationStartedAt: timestamp,
  confirmationDeadlineMs?: number,   // Unix ms дедлайн (60с), опционально
  confirmationResult: "accepted" | "rejected" | "discarded" | null,
  confirmationResolvedAt?: timestamp,
  confirmCount?: number,
  rejectCount?: number,
  abstainCount?: number,

  // Rating phase (только если confirmationResult === "accepted")
  ratingResult?: "completed" | null,
  ratingResolvedAt?: timestamp,
  finalScore?: number
}
```

### Подколлекция: `rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}/votes/{voterId}`

Голос конкретного eligible игрока по заданию.

**Структура документа:**
```javascript
{
  vote: "confirm" | "abstain" | "reject",
  votedAt: timestamp
}
```

### Подколлекция: `rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}/ratings/{raterId}`

Рейтинг конкретного игрока за выполненное задание (ставится только после confirmation vote === `"confirm"`).

**Структура документа:**
```javascript
{
  rating: 1 | 2 | 3 | 4 | 5 | 2.5,
  ratedAt: timestamp
}
```

### Подколлекция: `rooms/{roomId}/rounds/{roundId}/tasks/{taskId}` (агрегаты, опционально)

Агрегированный снимок для раунда (например, для табло/статистики). Дублирует ключевые поля из `assignments`.

**Структура документа:**
```javascript
{
  taskId: string,                    // Firestore taskId (task-<number>)
  roundId: string,
  provocateurId: string,
  targetId: string,
  status: "awaiting_confirmation" | "completed" | "failed" | "discarded",
  completedAt: timestamp,
  confirmationStartedAt: timestamp,
  confirmationDeadlineMs: number,    // Unix ms дедлайн (60с)
  eligibleVoterIds: string[],        // Список голосующих (все, кроме completedByUserId)
  eligibleVotersCount: number,       // Размер множества eligibleVoterIds
  totalVotes: number,                // Количество записанных голосов
  voteCounts: {                      // Агрегированные счётчики
    confirm: number,
    abstain: number,
    reject: number
  },
  confirmationResult: "accepted" | "rejected" | "discarded", // после резолюции
  confirmationResolvedAt: timestamp, // после резолюции
  resolutionTrigger: string          // "vote_submitted" | "timer_elapsed" | ...
}
```

## 🔄 Поток работы приложения

### 1. Создание комнаты
1. Пользователь вводит имя на `creater_screen.html`
2. Нажимает "Создать комнату"
3. Создается документ в `rooms` с уникальным кодом
4. Создатель добавляется как `host` в `rooms/{roomId}/users`
5. Данные сохраняются в `sessionStorage`
6. Редирект на `lobby.html`

### 2. Подключение к комнате
1. Пользователь вводит имя и код комнаты на `connection_screen.html`
2. Нажимает "Подключиться"
3. Система ищет комнату по коду
4. Пользователь добавляется как `player` в `rooms/{roomId}/users`
5. Данные сохраняются в `sessionStorage`
6. Редирект на `lobby.html`

### 3. Лобби
1. Отображается код комнаты
2. Real-time подписка на список пользователей
3. Каждый пользователь может переключить статус готовности
4. Когда все готовы, хост видит кнопку "Начать игру"
5. При нажатии:
   - Вызывается `assignTasksToRoom()` для распределения заданий
   - Генерируется и сохраняется `roundId`
   - Статус комнаты меняется на `"active"`
   - Все клиенты автоматически перенаправляются на `game.html`

### 4. Игровой экран
1. Загружаются задания пользователя из `rooms/{roomId}/users/{userId}`
2. Отображаются 3 кнопки с заданиями
3. Текст задания модифицируется для отображения имени целевого игрока
4. При клике на задание показывается подтверждение
5. По нажатию "Да" **не трогаем напрямую user-doc**, а пишем в assignment:
   - `completedAt: serverTimestamp()`
   - `status: "awaiting_confirmation"`
   - `confirmationStartedAt: serverTimestamp()`
   - `completedByUserId: currentUserId`
6. Одновременно создается/обновляется round-task документ (агрегаты):
   `rooms/{roomId}/rounds/{roundId}/tasks/{taskId}` с полями `eligibleVoterIds`, `confirmationDeadlineMs` и т.д.

### 5. Фаза подтверждения (голосование)
1. Popup **Task Confirmation** показывается автоматически только eligible игрокам:
   - **все игроки, кроме того, кто нажал "Да"** (`completedByUserId`)
2. В popup доступны кнопки:
   - ✔ Confirm
   - ◯ Abstain
   - ✖ Reject
3. Запущен синхронизированный таймер **60 секунд**.
4. Голос пишется в:
   `rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}/votes/{voterId}`
5. Двойное голосование запрещено (transaction + проверка существующего голоса).
6. По таймауту для не проголосовавших eligible игроков автоматически пишется `abstain`.

### 6. Резолюция результата подтверждения
Когда все голоса получены **или** истек таймер:

1. Подсчитываются `confirmCount`, `abstainCount`, `rejectCount`
2. Применяются правила:
   - если `confirmCount > rejectCount` → `accepted`
   - если `rejectCount > confirmCount` → `rejected`
   - иначе (ничья, все воздержались и т.п.) → `discarded`
3. Результат фиксируется **ровно один раз** (transaction) в `assignments/{assignmentId}`:
   - `confirmationResult`
   - `confirmationResolvedAt`
   - `status`:
     - `completed` для `accepted`
     - `failed` для `rejected`
     - `discarded` для `discarded`
   - `confirmCount` / `rejectCount` / `abstainCount`
4. Эти же агрегаты при наличии round-task дублируются в `rounds/{roundId}/tasks/{taskId}`.
5. В user-doc провокатора соответствующий элемент `tasks[i]` получает:
   - `status: "completed" | "failed" | "discarded"`
   - `confirmationResult`
   - `confirmationResolvedAt`
6. Клиенты автоматически получают обновление через real-time подписки и:
   - у провокатора его кнопка задания подсвечивается:
     - зелёным + лейбл `"Completed"` при `completed`
     - красным + лейбл `"Rejected"` при `failed`
     - серым + лейбл `"No decision"` при `discarded`

### 7. Фаза рейтинга (только после `confirmationResult === "accepted"`)
1. UI открывает popup **сразу после** того, как игрок проголосовал ✔ `confirm` в `Task Confirmation`.
2. Popup рейтинга НЕ открывается при ◯ `abstain` или ✖ `reject`.
3. RatingPopup НЕ показывается:
   - игроку, который нажал "Да" (`completedByUserId`)
   - если у игрока уже есть рейтинг (`ratings/{currentUserId}`)
4. Таймер рейтинга: **30 секунд**.
5. Если игрок не выбрал оценку до истечения таймера, автоматически ставится рейтинг `2.5`.
6. Рейтинги пишутся в:
   `rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}/ratings/{raterId}`
7. После завершения rating-phase вычисляется `finalScore`:
   - это среднее значение `rating` из `ratings`
   - пишется в assignment вместе с `ratingResult: "completed"` и `ratingResolvedAt`

## 🚀 Установка и запуск

### Требования
- Современный браузер с поддержкой ES6 Modules
- Аккаунт Firebase с настроенным проектом Firestore

### Настройка Firebase

1. Создайте проект в [Firebase Console](https://console.firebase.google.com/)
2. Включите Firestore Database
3. Скопируйте конфигурацию Firebase из консоли
4. Обновите `js/firebase.js` с вашими credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ...
};
```

### Настройка Firestore

1. Создайте коллекцию `taskTemplates`
2. Добавьте документы с ID в формате `task-1`, `task-2`, и т.д.
3. Каждый документ должен иметь поле `text` (string)

**Пример документа:**
- ID: `task-1`
- Поля: `{ text: "Заставь другого человека назвать овощ" }`

### Запуск локально

1. Клонируйте репозиторий
2. Откройте `index.html` в браузере
3. Или используйте локальный сервер:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server

# Затем откройте http://localhost:8000
```

### Правила безопасности Firestore

Рекомендуемые правила для разработки:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Комнаты - чтение/запись для всех (в продакшене добавить аутентификацию)
    match /rooms/{roomId} {
      allow read, write: if true;
      
      match /users/{userId} {
        allow read, write: if true;
      }

      match /rounds/{roundId} {
        allow read, write: if true;

        match /tasks/{taskId} {
          allow read, write: if true;

          match /votes/{voterId} {
            allow read, write: if true;
          }
        }
      }
    }
    
    // Шаблоны заданий - только чтение
    match /taskTemplates/{taskId} {
      allow read: if true;
      allow write: if false; // Только через консоль
    }
  }
}
```

## 📚 API документация

### `rooms.js`

#### `createRoom()`
Создает новую комнату с уникальным кодом.

**Возвращает:** `Promise<{roomId: string, code: string}>`

**Пример:**
```javascript
const { createRoom } = await import("./rooms.js");
const { roomId, code } = await createRoom();
console.log(`Room created: ${roomId}, code: ${code}`);
```

#### `joinRoom(roomId, userName, role)`
Добавляет пользователя в комнату.

**Параметры:**
- `roomId` (string) - ID комнаты
- `userName` (string) - Имя пользователя
- `role` (string, опционально) - Роль: `"host"` или `"player"` (по умолчанию `"player"`)

**Возвращает:** `Promise<string>` - ID пользователя

#### `findRoomByCode(code)`
Находит комнату по коду.

**Параметры:**
- `code` (string) - 4-символьный код комнаты

**Возвращает:** `Promise<string | null>` - ID комнаты или `null`

#### `updateUserReady(roomId, userId, ready)`
Обновляет статус готовности пользователя.

**Параметры:**
- `roomId` (string) - ID комнаты
- `userId` (string) - ID пользователя
- `ready` (boolean) - Статус готовности

#### `updateRoomStatus(roomId, status, roundId?)`
Обновляет статус комнаты. При передаче `roundId` сохраняет активный раунд в room-документе.

**Параметры:**
- `roomId` (string) - ID комнаты
- `status` (string) - Статус: `"waiting"` или `"active"`
- `roundId` (string, опционально) - ID раунда (например `round-1718123123`)

### `taskAssignment.js`

#### `assignTasksToRoom(roomId)`
Распределяет задания всем пользователям комнаты.

**Параметры:**
- `roomId` (string) - ID комнаты

**Логика:**
- Проверяет, не назначены ли уже задания
- Загружает все шаблоны заданий
- Проверяет достаточность заданий (нужно `users.length * 3`)
- Перемешивает задания случайным образом
- Для каждого пользователя:
  - Выбирает 3 уникальных задания
  - Для каждого задания выбирает целевого игрока
  - Балансирует распределение целей
- Сохраняет задания в документы пользователей

**Ошибки:**
- `Insufficient task templates` - недостаточно заданий в Firestore
- `Failed to assign exactly 3 tasks` - не удалось назначить 3 задания пользователю

### `taskTemplates.js`

#### `getAllTaskTemplates()`
Загружает все шаблоны заданий из Firestore.

**Возвращает:** `Promise<Array<{id: string, text: string}>>`

**Пример:**
```javascript
const { getAllTaskTemplates } = await import("./taskTemplates.js");
const templates = await getAllTaskTemplates();
console.log(`Loaded ${templates.length} templates`);
```

#### `isValidTaskIdFormat(taskId)`
Проверяет, соответствует ли taskId формату `task-<number>`.

**Параметры:**
- `taskId` (string) - ID задания

**Возвращает:** `boolean`

### `subscriptions.js`

#### `subscribeToRoom(roomId, onRoomUpdate)`
Подписывается на изменения документа комнаты.

**Параметры:**
- `roomId` (string) - ID комнаты
- `onRoomUpdate` (function) - Callback функция `(roomData, snapshot) => void`

**Возвращает:** `function` - Функция отписки

**Пример:**
```javascript
const { subscribeToRoom } = await import("./subscriptions.js");
const unsubscribe = subscribeToRoom(roomId, (roomData) => {
  if (roomData.status === "active") {
    // Переход на игровой экран
  }
});
```

#### `subscribeToRoomUsers(roomId, onUsersUpdate)`
Подписывается на изменения списка пользователей комнаты.

**Параметры:**
- `roomId` (string) - ID комнаты
- `onUsersUpdate` (function) - Callback функция `(users) => void`

**Возвращает:** `function` - Функция отписки

## 🔑 Важные концепции

### Разделение taskId и displayLabel

**Критически важно:** В системе строго разделены три концепции:

1. **taskId** (string) - Firestore document ID, например `"task-17"`
   - Используется для всех операций с данными
   - Хранится в Firestore
   - Используется для идентификации заданий

2. **taskData** (object) - Данные задания из Firestore
   - `text` - текст задания
   - Другие поля (изображения, сложность и т.д.)

3. **displayLabel** (string) - UI-only строка, например `"Task 2 (Anna)"`
   - Генерируется на клиенте для отображения
   - НИКОГДА не хранится в Firestore
   - НИКОГДА не используется как идентификатор

**Правила:**
- ✅ Все операции с Firestore используют только `taskId`
- ✅ Display labels генерируются на лету из:
  - Индекса задания в раунде
  - Имени целевого игрока
- ✅ Display labels никогда не попадают в Firestore

### Формат taskId

Все taskId должны соответствовать формату: `task-<number>`

**Примеры:**
- ✅ `task-1`
- ✅ `task-17`
- ✅ `task-123`
- ❌ `Task 1`
- ❌ `task1`
- ❌ `Task-1`

### Распределение заданий

**Алгоритм:**
1. Каждый пользователь получает ровно 3 задания
2. Все задания в комнате уникальны (не повторяются)
3. Целевые игроки распределяются балансированно
4. Пользователь не может быть целью своего собственного задания

**Требования:**
- Минимум 2 пользователя в комнате
- Минимум `users.length * 3` заданий в коллекции `taskTemplates`

### Confirmation flow и анонимность

- UI показывает popup голосования только eligible игрокам.
- В UI голоса анонимны (не отображается кто как проголосовал).
- В Firestore голос хранится с `voterId` (doc id) для технической валидации one-vote-per-user.
- Провокатор и цель задачи не имеют права голосовать.

### Exactly-once правила

- Завершение задачи (`completedAt`) защищено от дублей.
- Голос одного пользователя по задаче пишется ровно один раз (transaction).
- Резолюция результата (`confirmationResult`) выполняется ровно один раз (transaction + check resolved).
- Рейтинг одного пользователя по задаче пишется ровно один раз (`ratings/{raterId}`).
- Резолюция rating-фазы (`finalScore` + `ratingResult`) выполняется ровно один раз.

## 🐛 Отладка

### Структурированное логирование

Система использует префиксы для логов:

- `[TASK_LOAD]` - загрузка заданий из Firestore
- `[ROUND_START]` - начало раунда
- `[TASK_ASSIGN]` - назначение задания пользователю
- `[FIRESTORE_WRITE]` - запись в Firestore
- `[TASK_RENDER]` - отображение задания в UI
- `[TASK_ID_VALIDATION]` - валидация формата taskId
- `[TASK_COMPLETE]` - этап завершения задания провокатором
- `[TASK_PHASE]` - переход задачи между фазами
- `[TASK_VOTE]` - запись голосов и auto-abstain
- `[TASK_RESOLUTION]` - финальная резолюция результата

### Типичные проблемы

#### "Insufficient task templates: need 6, have 0"
**Причина:** Коллекция `taskTemplates` пуста или не найдена.

**Решение:**
1. Проверьте название коллекции в Firestore (должно быть `taskTemplates`)
2. Убедитесь, что документы имеют правильный формат ID (`task-1`, `task-2`, и т.д.)
3. Проверьте правила безопасности Firestore

#### "Failed to assign exactly 3 tasks"
**Причина:** Недостаточно уникальных заданий или ошибка валидации.

**Решение:**
1. Убедитесь, что в коллекции достаточно заданий (`users.length * 3`)
2. Проверьте формат taskId всех заданий
3. Проверьте консоль на ошибки валидации

#### Задания не отображаются
**Причина:** Ошибка загрузки или неверная структура данных.

**Решение:**
1. Проверьте консоль на ошибки `[TASK_LOAD]`
2. Убедитесь, что в документе пользователя есть поле `tasks` (массив)
3. Проверьте, что каждое задание имеет поля `taskId`, `taskText`, `targetName`

#### Confirmation popup не появляется
**Причина:** Пользователь не входит в eligible voters, нет `roundId`, или задача уже зарезолвлена.

**Решение:**
1. Проверьте `rooms/{roomId}.roundId`
2. Проверьте `round task` документ в `rooms/{roomId}/rounds/{roundId}/tasks/{taskId}`
3. Убедитесь, что пользователь не равен `provocateurId` и не равен `targetId`
4. Проверьте логи `[TASK_PHASE]` и `[TASK_VOTE]`

#### Разные итоги у клиентов (race condition)
**Причина:** Обычно связана с ручными изменениями данных вне транзакций.

**Решение:**
1. Не изменяйте `confirmationResult` вручную из консоли
2. Убедитесь, что резолюция идет только через transaction
3. Проверьте логи `[TASK_RESOLUTION]`

### Проверка данных в Firestore

**Правильная структура задания:**
```javascript
{
  taskId: "task-17",           // ✅ Firestore docId
  taskText: "Заставь...",      // ✅ Текст задания
  targetUserId: "abc123",      // ✅ ID целевого игрока
  targetName: "Anna"           // ✅ Имя целевого игрока
}
```

**Неправильная структура:**
```javascript
{
  taskId: "Task 1",            // ❌ Не формат task-<number>
  taskText: "Task 1 (Anna)",   // ❌ Содержит display label
  // ...
}
```

## 📝 TODO / Будущие улучшения

- [ ] Добавление аутентификации пользователей
- [x] Запись `completedAt` timestamp при подтверждении задания
- [x] Confirmation popup для eligible игроков + 30s таймер + auto-abstain
- [x] Одноразовая резолюция результата (`accepted` / `rejected` / `discarded`)
- [ ] Система подсчета очков для `accepted` задач
- [ ] История выполненных заданий
- [ ] Возможность перезапуска раунда
- [ ] Адаптивный дизайн для мобильных устройств
- [ ] Обработка ошибок сети
- [ ] Индикаторы загрузки
- [ ] Анимации переходов между экранами

## 📄 Лицензия

Проект создан в образовательных целях.

## 👥 Авторы

Разработано для изучения Firebase Firestore и real-time приложений.
