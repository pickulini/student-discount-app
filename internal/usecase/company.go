package usecase

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type CompanyUsecase struct {
    companyRepo  repository.CompanyRepository
    locationRepo repository.LocationRepository
    offerRepo    repository.OfferRepository
}

func NewCompanyUsecase(
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
) *CompanyUsecase {
    return &CompanyUsecase{
        companyRepo:  companyRepo,
        locationRepo: locationRepo,
        offerRepo:    offerRepo,
    }
}

func (u *CompanyUsecase) ListCompanies(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    return u.companyRepo.List(ctx, limit, offset)
}

func (u *CompanyUsecase) GetCompany(ctx context.Context, id int64) (*domain.Company, error) {
    return u.companyRepo.GetByID(ctx, id)
}

func (u *CompanyUsecase) GetLocations(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error) {
    return u.locationRepo.GetByCompanyID(ctx, companyID)
}

func (u *CompanyUsecase) ListOffers(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    return u.offerRepo.List(ctx, filters, limit, offset)
}

func (u *CompanyUsecase) GetOffer(ctx context.Context, id int64) (*domain.Offer, error) {
    return u.offerRepo.GetByID(ctx, id)
}
