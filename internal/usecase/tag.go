package usecase

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
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
