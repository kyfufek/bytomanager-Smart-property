NÁZEV PROJEKTU: BYTOMANAGER
JEDNOVĚTÝ POPIS: 
Aplikace/web, který vytváří přehled zisků a výdajů bytových jednotek, najemníků, nuných oprav a práva vztahujícího se k oblasti bydlení

PROBLÉM, KTERÝ ŘEŠÍ:
Zdlouhavé ruční vytváření tabulek a neefektivní a nepřehlený management.

CÍLOVÝ UŽIVATEL:
Rentiér, podnikatel

HLAVNÍ FUNKCE (MVP) -- co aplikace musí umět v první verzi:
1. analýza dat
2. shrnutí dat
3. generování tabulek
4. přehled nemovitostí – evidence jednotek a vlastníku
5. přehledné uživatelské rozhraní

CO APLIKACE V MVP NEBUDE UMĚT (out of scope):
- 
- ...

JAK SE PROJEKT LIŠÍ OD EXISTUJÍCÍCH ŘEŠENÍ:
... (např. "Na rozdíl od Splitwise se zaměřuje čistě na účtenky z českých obchodů")

STRUKTURA REPOZITÁŘE:
- frontend/  -- uživatelské rozhraní (bude vytvořeno v Lovable, pak upravováno lokálně)
- backend/   -- serverová logika a API (bude implementováno lokálně pomocí Codexu)

TECH STACK:
1. Frontend (To, co uživatel vidí a na co kliká)
•	React.js / Next.js: Aktuální král tvorby webových aplikací. Většina AI generátorů (jako Lovable nebo v0) vám kód "vyplivne" přesně v Reactu. Je to rychlé, plynulé a firmy to vyžadují.
•	Tailwind CSS: Jak už jsme zmiňovali v zadání. Nejmodernější způsob, jak dělat krásný design bez psaní kilometrů složitého CSS kódu.
•	TypeScript: Nadstavba JavaScriptu. Na pohovoru to funguje jako magie. Ukazuje to, že nepíšete "špagetový kód", ale bezpečný kód, který předchází chybám.
🧠 2. AI a Logika (Mozek aplikace)
•	OpenAI API (GPT-4o): Hlavní textový a logický engine. Bude číst zprávy od nájemníků a tvořit odpovědi.
•	LangChain: Speciální programovací knihovna přímo pro umělou inteligenci. Použijete ji na ten váš "RAG systém" (aby AI uměla číst vaše PDF smlouvy).
•	Pinecone (nebo Supabase pgvector): Tzv. vektorová databáze. To je speciální moderní paměť pro AI, do které se ty zákony a PDF smlouvy rozsekají, aby v nich AI uměla bleskově hledat. Tohle slovíčko personalisty na technických pozicích vždycky ohromí.
🗄️ 3. Backend a Databáze (Trezor na data)
•	Supabase: Tohle je aktuálně obrovský hit. Je to alternativa k Firebase. Obsahuje plnohodnotnou databázi PostgreSQL (na finance a seznam nájemníků naprosto ideální) a navíc vám sama vyřeší přihlašování uživatelů (registraci, hesla).
•	Node.js: Běhové prostředí, ve kterém bude fungovat ta neviditelná propojovací logika na pozadí.
🚀 4. DevOps a Nástroje (Stavba a kurýr)
•	Git & GitHub: Vaše správa verzí (to už máte napojené a umíte to!).
•	Vercel: Služba na nahrání webu na internet. Pro aplikace psané v Next.js/Reactu je to to nejjednodušší na světě. Jen to propojíte s vaším GitHubem a web je online.
•	Visual Studio Code: Vaše hlavní "staveniště".

OBRAZOVKY / STRÁNKY APLIKACE:
1. ... (např. "Hlavní stránka – přáhlášení popř. registrace)
2. ...  po prihlasení nejaka hlavní stranka s informacemi a lehkym ovladaním nahore bude lista k rozkliknuti s tlacitky mé nemovitosti, najemnici, finance, historie atd.
3. ... 
4. ...
5. ...

NAVIGACE MEZI STRÁNKAMI:
... horní lišta kde budou 3 čárky symbolizující vyjíždějící lištu ve ktere budou odkazy na stranky: nemovitosti, nájemníci, finance, historie …

BRANDING:
- Název aplikace (jak se zobrazuje v UI): Bytomanager
- Logo: ... logo signalizující písmena B a M ktere jsou spojene a symbolizují byt z horní perspektivy
- Tón komunikace v aplikaci: ... Profesionální ale ne nepřátelský
- Claim / slogan (nepovinné): ... Mějte kontrolu nad svými nemovitostmi. “Pořádek dělá přátele”

BAREVNÉ SCHÉMA:
- Primární barva: ... bílá, světle šedá, černá
- Sekundární barva: ... středně světlá oranžová, tak aby ladila se šedivou
- Barva pozadí: ... bílá/šedá
- Barva textu: černá
- Accent / CTA barva: bíla, šedá, oranžová, černá
- Styl: Moderní a minimalistický

TYPICKÝ PRŮCHOD UŽIVATELE (user flow):
1. Uživatel otevře aplikaci a vidí: okno pro přihlášení nebo vytvoření účtu
2. Klikne na: sign in/sign up
3. Vyplní / nahraje: přihlašovací údaje, informace o svých nemovitostech a nájemnících
4. Systém zpracuje a zobrazí: zpracuje text a zobrazí shrnutí/tabulky
5. Uživatel může dále: konzultovat s botem specializovaných na problematiku nemovitostí

AUTENTIZACE A UŽIVATELÉ:
- Potřebuje aplikace přihlášení?  ano 
- Způsob přihlášení: email/username + heslo, Google OAuth, žádné 
- Uživatelské role: běžný uživatel
- Co vidí nepřihlášený uživatel: redirect na sign in/sign up

DATA, KTERÁ UŽIVATEL ZADÁVÁ:
... (např. fotka účtenky, typ nemovitosti, kategorie nemovitosti)

DATA, KTERÁ APLIKACE UKLÁDÁ:
... položky z účtenky, výpis z účtu, informace o přihlášených, historie

EXTERNÍ ZDROJE DAT:
... OpenAI pro analýzu občanského zákoníku

FORMÁT VÝSTUPU PRO UŽIVATELE:
... tabulka, graf, text

CHYBOVÉ STAVY:
- Chybný vstup od uživatele: ... (např. "Zobrazit validační hlášku u formuláře")
- Výpadek externího API: ... (např. "Zobrazit chybovou hlášku a nabídnout retry")
- Prázdný stav (žádná data): ... (např. "Zobrazit ilustraci s textem 'Zatím nemáte žádné účtenky'")
- Pomalé načítání: ... (např. "Zobrazit skeleton loading")

Project Title: BytoManažer - Next-Gen AI Property Management Dashboard
General UI/UX Style Guidelines:
•	Style: Modern, clean, B2B SaaS corporate look, highly professional.
•	Colors: Light theme. White backgrounds for content cards, very subtle light gray #F9FAFB for the main app background. Primary accent color should be a trustworthy deep blue or indigo. Use green/red badges for paid/unpaid statuses.
•	Layout: Full-width web application. Left sidebar for main navigation (collapsible on mobile) and a top header for search, notifications, and user profile.
•	Components: Use rounded corners (soft borders), subtle drop shadows for cards, and clear typography (sans-serif like Inter or Roboto).
Core Navigation (Left Sidebar Menu):
•	📊 Dashboard (Overview)
•	🏢 My Properties
•	👥 Tenants & AI Comms
•	💰 Finances & Payments
•	⚖️ AI Legal Advisor & Docs
•	⚙️ Settings
Screen 1: Dashboard (The Main Screen) Please generate the main Dashboard view containing the following sections:
1.	Top Header: Welcome message ("Welcome back, Kryštof"), a global search bar, and an alert bell icon with a red notification dot.
2.	KPI Summary Cards (Top Row): * Total Monthly Revenue: e.g., "125,000 CZK" with a small green trend arrow "+5% vs last month".
o	Active Tenants: e.g., "18/20 units occupied".
o	AI Action Items: e.g., "3 Pending Alerts" (highlighted in orange).
3.	Financial Overview Chart (Middle Left): A clean line or bar chart showing "Revenue vs. Expenses" over the last 6 months.
4.	AI Smart Alerts Widget (Middle Right): A visually distinct card featuring "AI Assistant Insights". It should list automated alerts, such as:
o	"⚠️ Tenant in Byt A is 3 days late on rent. Auto-SMS reminder scheduled."
o	"💡 Inflation rose by 2%. You can legally increase rent for 3 properties. [Generate Addendums]"
o	"🔧 Predictive Maintenance: Boiler in Byt C is due for annual check next month."
5.	Recent Activity Table (Bottom): A table showing recent events (e.g., "Rent Paid - Byt B", "AI processed maintenance request - Byt D", "New lease signed"). Columns: Date, Property, Event, Status Badge.
Screen 2: Tenants & AI Comms (Feature Description for UI) If possible, show a split-screen layout for this section:
1.	Left side - Tenant List: A scrollable list of tenants with their profile pictures, property name, and a status indicator (Green = Paid, Red = Overdue).
2.	Right side - AI Inbox: A messaging interface where the property manager can see conversations. Show a sample message where a tenant reports a broken washing machine, and the AI automatically tags it as "Maintenance", assesses the urgency, and drafts a polite response for the manager to approve.
Screen 3: AI Legal Advisor & Docs (Feature Description for UI) Create a layout focused on document management and AI chat:
1.	Top Section - Document Vault: Grid of uploaded PDF documents (e.g., "Lease Agreement 2025", "Energy Bills").
2.	Bottom Section - RAG Legal Chatbot: A chat interface specifically for the landlord. The input placeholder should say "Ask AI about your contracts or local property laws...".
3.	Chat Example: Show a chat bubble from the user asking: "Can I evict the tenant in Byt A for having a dog?". Show the AI responding with a cited answer based on the uploaded "Lease Agreement 2025", accompanied by a button saying "Draft Notice Letter".
(stejná struktura)

