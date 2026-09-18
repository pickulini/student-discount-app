package usecase

import (
	"context"
	"strings"

	"your-project/internal/domain"
	"your-project/internal/repository"
	"your-project/internal/util"
)

type TagUsecase struct {
	tagRepo repository.TagRepository
}

func NewTagUsecase(tagRepo repository.TagRepository) *TagUsecase {
	return &TagUsecase{tagRepo: tagRepo}
}

func (u *TagUsecase) List(ctx context.Context) ([]domain.Tag, error) {
	return u.tagRepo.List(ctx)
}

func (u *TagUsecase) Popular(ctx context.Context, limit int) ([]domain.TagPopular, error) {
	return u.tagRepo.ListPopular(ctx, limit)
}

func (u *TagUsecase) Search(ctx context.Context, query string, limit int) ([]domain.Tag, error) {
	return u.tagRepo.Search(ctx, query, limit)
}

// ResolveAndAttach принимает массив "хештегов" от партнёра, парсит,
// находит/создаёт теги (pending) и привязывает к офферу.
// Возвращает финальный список тегов оффера.
func (u *TagUsecase) ResolveAndAttach(ctx context.Context, offerID int64, hashtags []string, createdBy *int64) ([]domain.Tag, error) {
	if len(hashtags) == 0 {
		return []domain.Tag{}, nil
	}

	seen := make(map[string]bool)
	var tagIDs []int64
	var result []domain.Tag

	for _, raw := range hashtags {
		// нормализуем: убираем #, тримим
		clean := strings.TrimSpace(strings.TrimLeft(raw, "#@"))
		if clean == "" {
			continue
		}
		slug := util.SlugifyUsername(clean) // переиспользуем slugify
		if slug == "" {
			continue
		}
		if seen[slug] {
			continue
		}
		seen[slug] = true

		tag, err := u.tagRepo.Upsert(ctx, clean, slug, createdBy)
		if err != nil {
			return nil, err
		}
		tagIDs = append(tagIDs, tag.ID)
		result = append(result, *tag)

		if len(tagIDs) >= 10 {
			break
		}
	}

	if err := u.tagRepo.SetOfferTags(ctx, offerID, tagIDs); err != nil {
		return nil, err
	}
	return result, nil
}

// ActivateOfferTags — вызвать при публикации оффера
func (u *TagUsecase) ActivateOfferTags(ctx context.Context, offerID int64) error {
	return u.tagRepo.ActivateByOfferID(ctx, offerID)
}

// ListAllAdmin — для админки
func (u *TagUsecase) ListAllAdmin(ctx context.Context, status string, limit, offset int) ([]domain.Tag, error) {
	return u.tagRepo.ListAllAdmin(ctx, status, limit, offset)
}
