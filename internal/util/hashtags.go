package util

import (
	"strings"
	"unicode"
)

// ParseHashtags разбивает ввод на отдельные хештеги.
// Разделители: пробел, запятая, точка с запятой, Enter, таб.
// Убирает # в начале, схлопывает мусор, дедуплицирует (без учёта регистра).
// Максимум 10 уникальных тегов.
func ParseHashtags(input string) []string {
	if input == "" {
		return nil
	}
	// все разделители → пробел
	sep := func(r rune) bool {
		return r == ' ' || r == ',' || r == ';' || r == '\n' || r == '\t' || r == '\r'
	}
	parts := strings.FieldsFunc(input, sep)

	seen := make(map[string]bool)
	var out []string

	for _, p := range parts {
		// убираем #, @, мусор по краям
		p = strings.TrimLeft(p, "#@")
		p = strings.TrimFunc(p, func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_'
		})
		if p == "" {
			continue
		}
		key := strings.ToLower(p)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, p)
		if len(out) >= 10 {
			break
		}
	}
	return out
}
