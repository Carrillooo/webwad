# START: zbuduj swoją pierwszą stronę

Bez programowania i bez terminala. Ty mówisz, agent buduje.

## Czego potrzebujesz
- **Claude Code** (zalecane) albo **Codex**, w płatnym planie (od około 20 $ miesięcznie).
  - Claude Code: zainstaluj aplikację Claude ze strony claude.com/download i zaloguj się.
  - Codex: jest częścią płatnego planu ChatGPT.
- To wszystko. Pozostałe narzędzia agent instaluje sam.
- Opcjonalnie: generator obrazów lub wideo, jeśli chcesz zdjęcia i filmy zrobione przez AI. Agent
  powie, kiedy się przyda, i napisze dla Ciebie prompty.

## 1. Przygotuj folder (1 minuta)
1. Rozpakuj kit.
2. Zmień nazwę folderu na nazwę projektu, na przykład `strona-kawiarni`.
3. Trzymaj wszystkie projekty w jednym folderze nadrzędnym, na przykład `Strony/`.

**Każda nowa strona = świeża kopia folderu kitu.** Nigdy nie buduj dwóch stron w jednym folderze.

## 2. Otwórz folder w agencie
- **Aplikacja Claude:** otwórz zakładkę Code, wybierz „Select folder” i wskaż folder projektu.
- **Dla osób pracujących w terminalu:** otwórz folder w terminalu i uruchom `claude` (albo `codex`).

Do pierwszej budowy wybierz najmocniejszy model i najwyższy poziom wysiłku (effort). Do drobnych
poprawek wystarczy niższe ustawienie, jest też tańsze.

## 3. Wyślij pierwszą wiadomość
```
Cześć, zróbmy stronę.
```
Przy pierwszym uruchomieniu agent sprawdza Twój komputer i instaluje to, czego brakuje. Może poprosić
o zgodę na wykonanie polecenia: zgódź się. Trwa to kilka minut, tylko raz.

Potem zaproponuje cztery ścieżki:
- **A** Po prostu pokaż mi coś efektownego (nie trzeba mieć pomysłu)
- **B** Strona dla mojej firmy albo klienta
- **C** Mam już pomysł albo referencje
- **D** Odtwórz gotowy przepis

Nie wiesz, co wybrać? Na pierwszą stronę weź **A**. To najszybszy sposób, żeby zobaczyć, co potrafi kit.

## 4. Co dzieje się dalej
1. **Pomysł.** Agent proponuje koncepcje. Wybierasz jedną.
2. **Referencje.** Analizuje prawdziwe, nagradzane strony pasujące do pomysłu.
3. **Podsumowanie.** Dostajesz pięć linijek: nastrój, kolory, fonty, główny efekt. Mówisz „tak” albo
   prosisz o zmiany.
4. **Media na pierwszy ekran.** Agent mówi dokładnie, jakiego zdjęcia, filmu albo modelu 3D
   potrzebuje pierwszy ekran, gdzie go zrobić i jakim promptem. Wrzucasz plik do wskazanego folderu.
5. **Budowa.** Buduje stronę sekcja po sekcji i otwiera Ci podgląd.
6. **Autokontrola.** Robi zrzuty własnej pracy i poprawia to, co nie gra.
7. **Reszta mediów, poprawki, publikacja.** Pomaga wystawić stronę online na darmowym hostingu.

Na pierwszą stronę zaplanuj kilka godzin. Kolejne idą szybciej.

## 5. Jak prosić o zmiany
Pisz tak, jak mówiłbyś do projektanta:
- „Nagłówek jest za duży na telefonie.”
- „Zrób spokojniejszy pierwszy ekran.”
- „Nie podobają mi się kolory, pokaż dwie inne opcje.”

Najlepiej działa jedna prośba na wiadomość. Na typowe problemy („wygląda martwo”, „model 3D jest
ciemny”, „zacina się”) gotowe zwroty są w `system/08-fix-prompts.md` (po angielsku, ale do agenta
możesz pisać po polsku).

## 6. Referencje (opcjonalne, bardzo pomagają)
- Linki do stron, które Ci się podobają: wklej do `refs/sites.txt`, jeden w linii.
- Zrzuty ekranu albo obrazy z Pinteresta: wrzuć do `refs/images/`.

Nie masz referencji? Agent sam dobierze je do Twojego pomysłu.

## Gdy coś pójdzie nie tak
- **Agent się zatrzymał albo zgubił.** Napisz: „Przeczytaj brief.md i kontynuuj od miejsca, w którym
  skończyłeś.”
- **Instalacja się nie udała.** Skopiuj treść błędu do czatu i napisz „napraw to”. Jeśli poprosi,
  żebyś sam uruchomił jedno polecenie, skopiuj je dokładnie tak, jak je podał.
- **Podgląd się nie otwiera.** Napisz: „Uruchom lokalny serwer i podaj mi link.”
- **Skończył Ci się limit w planie.** Poczekaj na reset widoczny w aplikacji i napisz „kontynuuj”.
  Postęp jest zapisany w `brief.md`.
- **Chcesz zacząć od nowa.** Zrób świeżą kopię folderu kitu. Nie używaj starego ponownie.
- **Dalej nie działa?** Napisz na hello@madebyeveren.com i opisz, co się stało. Zrzuty ekranu pomagają.

## Podziękowania
Biblioteka składni promptów dla modeli obrazu i wideo (`vendor/visual-skills/`): Serge Shima,
github.com/smixs/visual-skills, licencja CC BY 4.0.
