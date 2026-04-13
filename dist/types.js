/** Check if usage limit is reached (either window at 100%) */
export function isLimitReached(data) {
    if (data.provider === 'glm') {
        return false;
    }
    return data.fiveHour === 100
        || data.sevenDay === 100;
}
//# sourceMappingURL=types.js.map