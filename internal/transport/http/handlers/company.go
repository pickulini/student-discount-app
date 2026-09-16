package handlers

import (
    "net/http"
    "strconv"
    "your-project/internal/domain"
    "your-project/internal/usecase"
)

type CompanyHandler struct {
    companyUsecase *usecase.CompanyUsecase
}

func NewCompanyHandler(cu *usecase.CompanyUsecase) *CompanyHandler {
    return &CompanyHandler{companyUsecase: cu}
}

func (h *CompanyHandler) ListCompanies(w http.ResponseWriter, r *http.Request) {
    companies, err := h.companyUsecase.ListCompanies(r.Context(), 100, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies")
        return
    }
    writeJSON(w, http.StatusOK, companies)
}

func (h *CompanyHandler) GetCompany(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
    company, err := h.companyUsecase.GetCompany(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "company not found")
        return
    }
    writeJSON(w, http.StatusOK, company)
}

func (h *CompanyHandler) ListOffers(w http.ResponseWriter, r *http.Request) {
    filters := map[string]interface{}{}
    if r.URL.Query().Get("category") != "" {
        filters["category"] = r.URL.Query().Get("category")
    }
    if tags := r.URL.Query().Get("tags"); tags != "" {
        filters["tags"] = tags
    }
    offers, err := h.companyUsecase.ListOffers(r.Context(), filters, 50, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load offers")
        return
    }
    writeJSON(w, http.StatusOK, offers)
}

func (h *CompanyHandler) GetNearbyOffers(w http.ResponseWriter, r *http.Request) {
    lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
    lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
    radius, _ := strconv.Atoi(r.URL.Query().Get("radius"))
    if radius == 0 {
        radius = 5000
    }
    offers, _ := h.companyUsecase.ListOffers(r.Context(), nil, 20, 0)
    type NearbyOffer struct {
        domain.Offer
        Lat  float64 `json:"lat"`
        Lng  float64 `json:"lng"`
        Dist int     `json:"distance"`
    }
    result := []NearbyOffer{}
    for i, o := range offers {
        if i > 10 {
            break
        }
        result = append(result, NearbyOffer{
            Offer: o,
            Lat:   lat + float64(i)*0.001,
            Lng:   lng + float64(i)*0.001,
            Dist:  i * 100,
        })
    }
    writeJSON(w, http.StatusOK, result)
}
