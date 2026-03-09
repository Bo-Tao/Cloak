import { describe, it, expect } from 'vitest'
import { encodeProjectPath } from '../services/session-manager'

describe('SessionManager', () => {
  it('encodes project path', () => {
    expect(encodeProjectPath('/Users/botao/projects/myapp')).toBe(
      '-Users-botao-projects-myapp',
    )
  })

  it('encodes path with special characters', () => {
    expect(encodeProjectPath('/home/user/my project')).toBe(
      '-home-user-my-project',
    )
  })

  it('handles root path', () => {
    expect(encodeProjectPath('/')).toBe('-')
  })
})
