/********************************************************************************
 * Rikkei Ide — cấu hình đăng nhập (Settings).
 *   rikkeiIde.sc.baseUrl : URL server Simple Care (IDE chỉ nói chuyện với SC)
 *   rikkeiIde.portalUrl  : URL trang đăng nhập LMS Portal (lms-student)
 ********************************************************************************/

import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';
import { RIKKEI_SC_BASE_URL_PREF } from './rikkei-auth-service';

export const RikkeiAuthPreferenceSchema: PreferenceSchema = {
    properties: {
        [RIKKEI_SC_BASE_URL_PREF]: {
            type: 'string',
            default: 'https://sc.rikkeiedu.com',
            description: 'Rikkei Ide — URL server Simple Care. IDE mở trang đăng nhập {sc}/login, SC đăng nhập LMS (local) và trả danh tính; sau đó IDE mở socket SC (role=ide). Để trống = tắt bắt buộc đăng nhập.',
        },
    },
};
