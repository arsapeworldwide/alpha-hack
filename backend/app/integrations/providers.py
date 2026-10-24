from app.core.config import Settings
from app.integrations.bki import BkiSimulator
from app.integrations.egrul import EgrulSimulator

EGRUL_PROVIDERS = {"simulator": EgrulSimulator}
BKI_PROVIDERS = {"simulator": BkiSimulator}


def build_integrations(settings: Settings, session_factory):
    egrul = EGRUL_PROVIDERS[settings.egrul_provider](session_factory)
    bki = BKI_PROVIDERS[settings.bki_provider](session_factory, settings.simulate_bki_failure)
    return egrul, bki
