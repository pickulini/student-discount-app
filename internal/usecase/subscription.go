package usecase

import (
	"context"
	"errors"

	"your-project/internal/domain"
	"your-project/internal/repository"
)

type SubscriptionUsecase struct {
	subRepo     repository.CompanySubscriptionRepository
	companyRepo repository.CompanyRepository
	userRepo    repository.UserRepository
}

func NewSubscriptionUsecase(
	subRepo repository.CompanySubscriptionRepository,
	companyRepo repository.CompanyRepository,
	userRepo repository.UserRepository,
) *SubscriptionUsecase {
	return &SubscriptionUsecase{
		subRepo:     subRepo,
		companyRepo: companyRepo,
		userRepo:    userRepo,
	}
}

func (u *SubscriptionUsecase) Subscribe(ctx context.Context, userID, companyID int64) error {
	c, err := u.companyRepo.GetByID(ctx, companyID)
	if err != nil || c == nil {
		return errors.New("компания не найдена")
	}
	if !c.IsActive {
		return errors.New("компания неактивна")
	}
	return u.subRepo.Subscribe(ctx, userID, companyID)
}

func (u *SubscriptionUsecase) Unsubscribe(ctx context.Context, userID, companyID int64) error {
	return u.subRepo.Unsubscribe(ctx, userID, companyID)
}

func (u *SubscriptionUsecase) IsSubscribed(ctx context.Context, userID, companyID int64) (bool, error) {
	return u.subRepo.IsSubscribed(ctx, userID, companyID)
}

func (u *SubscriptionUsecase) MyCompanies(ctx context.Context, userID int64) ([]domain.CompanyWithSubscription, error) {
	companies, err := u.subRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]domain.CompanyWithSubscription, 0, len(companies))
	for _, c := range companies {
		result = append(result, domain.CompanyWithSubscription{
			ID:           c.ID,
			Name:         c.Name,
			Description:  c.Description,
			LogoKey:      c.LogoKey,
			IsSubscribed: true,
			IsActive:     c.IsActive,
		})
	}
	return result, nil
}

func (u *SubscriptionUsecase) Stats(ctx context.Context, companyID int64) (*domain.CompanyStats, error) {
	count, err := u.subRepo.CountByCompany(ctx, companyID)
	if err != nil {
		return nil, err
	}
	return &domain.CompanyStats{SubscribersCount: count}, nil
}

// SubscribedIDs — для фронта, чтобы отрисовать звёздочку на офферах
func (u *SubscriptionUsecase) SubscribedIDs(ctx context.Context, userID int64) ([]int64, error) {
	return u.subRepo.ListSubscribedCompanyIDs(ctx, userID)
}
