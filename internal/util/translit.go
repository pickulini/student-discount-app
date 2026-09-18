package util

import (
	"strings"
	"unicode"
)

// кириллица → латиница (для генерации username из ФИО)
var translitMap = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d",
	'е': "e", 'ё': "e", 'ж': "zh", 'з': "z", 'и': "i",
	'й': "y", 'к': "k", 'л': "l", 'м': "m", 'н': "n",
	'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t",
	'у': "u", 'ф': "f", 'х': "h", 'ц': "ts", 'ч': "ch",
	'ш': "sh", 'щ': "sch", 'ъ': "", 'ы': "y", 'ь': "",
	'э': "e", 'ю': "yu", 'я': "ya",
	// украинские/белорусские — на всякий
	'і': "i", 'ї': "yi", 'є': "ye", 'ґ': "g", 'ў': "u",
}

// SlugifyUsername берёт строку (обычно full_name), транслитерирует и
// возвращает username: [a-z0-9_], длина 3..30.
// Если получилось < 3 символов — вернёт "". Обработка коллизий — на вызывающем.
func SlugifyUsername(input string) string {
	var b strings.Builder
	lowered := strings.ToLower(input)

	for _, r := range lowered {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '_' || r == '-' || r == '.':
			b.WriteRune('_')
		case unicode.Is(unicode.Cyrillic, r):
			if v, ok := translitMap[r]; ok {
				b.WriteString(v)
			}
		}
	}

	out := b.String()
	for strings.Contains(out, "__") {
		out = strings.ReplaceAll(out, "__", "_")
	}
	out = strings.Trim(out, "_")

	if len(out) > 30 {
		out = out[:30]
		out = strings.TrimRight(out, "_")
	}
	if len(out) < 3 {
		return ""
	}
	return out
}
